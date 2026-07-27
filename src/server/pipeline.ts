import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { ApifyClient } from "apify-client";
import { db } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import {
  encryptSensitive,
  hashEmail,
  hashIdentifier,
  hashPhone,
  maskEmail,
  maskPhone,
} from "@/lib/server/crypto";
import { ApifyProspectProvider } from "@/server/providers/apify";
import { DemoProspectProvider } from "@/server/providers/demo";
import type {
  ProspectProvider,
  SourceProvenance,
} from "@/server/providers/types";
import {
  dedupeProspects,
  normalizeProspect,
  type NormalizedProspect,
} from "@/server/normalize";
import { scoreProspect, type ScoreResult } from "@/server/scoring";
import { analyzeProspect, type ProspectAnalysis } from "@/server/ai";
import { writeAudit } from "@/server/audit";
import { removeApifySourceArtifacts } from "@/server/provider-cleanup";
import { persistCompanyIntelligence } from "@/server/company-intelligence";
import { structuredFilterDecision } from "@/server/filtering";
import {
  candidateCollectionTarget,
  meetsScoreThreshold,
} from "@/server/qualification";
import {
  evaluateConsumerPermission,
  screenConsumerRecord,
} from "@/server/compliance";
import {
  analysisStageProgress,
  mapConcurrentOrdered,
  orderedWindows,
  ResultBudget,
} from "@/server/concurrency";
import { createProfileSnapshot } from "@/server/profile-snapshot";

class IdentityConflictError extends Error {}
class ScoreThresholdError extends Error {}
class JobLeaseLostError extends Error {}

export { meetsScoreThreshold } from "@/server/qualification";

type JobLease = {
  runToken: string;
  assertActive: () => void;
  stop: () => void;
};

function startJobLease(jobId: string, runToken: string): JobLease {
  let stopped = false;
  let lost = false;
  let renewing = false;
  const renew = async () => {
    if (stopped || lost || renewing) return;
    renewing = true;
    try {
      const result = await db.searchJob.updateMany({
        where: { id: jobId, status: "RUNNING", runToken },
        data: { heartbeatAt: new Date() },
      });
      if (!result.count) lost = true;
    } catch {
      // A transient database outage also prevents another worker from claiming
      // the lease. The next heartbeat/progress write re-checks ownership.
    } finally {
      renewing = false;
    }
  };
  const timer = setInterval(
    () => void renew(),
    env.SEARCH_JOB_HEARTBEAT_INTERVAL_MS,
  );
  timer.unref?.();
  return {
    runToken,
    assertActive: () => {
      if (lost || stopped) throw new JobLeaseLostError("Search job lease lost");
    },
    stop: () => {
      stopped = true;
      clearInterval(timer);
    },
  };
}

export function isCanonicalIdentityRace(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function provider(): ProspectProvider {
  if (env.apifyEnabled) return new ApifyProspectProvider();
  if (env.mockDataEnabled) return new DemoProspectProvider();
  throw new Error("Prospect provider is not configured");
}

function permissionHasReachableChannel(
  item: Extract<NormalizedProspect, { mode: "B2C" }>,
  channels: Array<"EMAIL" | "LINKEDIN" | "PHONE" | "WHATSAPP">,
) {
  return channels.some(
    (channel) =>
      (channel === "EMAIL" && Boolean(item.consumer.email)) ||
      ((channel === "PHONE" || channel === "WHATSAPP") &&
        Boolean(item.consumer.phone)),
  );
}

export function trustedNegativePermissionEvent(
  item: Extract<NormalizedProspect, { mode: "B2C" }>,
  now = new Date(),
) {
  if (
    item.consumer.consentStatus !== "DENIED" &&
    item.consumer.consentStatus !== "WITHDRAWN"
  ) {
    return null;
  }
  const occurredAt = item.consumer.consentCapturedAt
    ? new Date(item.consumer.consentCapturedAt)
    : null;
  const sourcePermissioned =
    item.provenance.sourceType === "DEMO" ||
    Boolean(
      item.provenance.permissionReview?.approved &&
      item.provenance.permissionReview.permissions?.some((permission) =>
        ["first_party_data", "permissioned_consumer_data"].includes(
          permission.toLowerCase(),
        ),
      ),
    );
  if (
    !occurredAt ||
    !Number.isFinite(occurredAt.getTime()) ||
    occurredAt > now ||
    occurredAt < new Date(now.getTime() - 2 * 365 * 86_400_000) ||
    !item.consumer.consentProofReference ||
    !item.consumer.consentSource ||
    !sourcePermissioned ||
    (!item.consumer.email && !item.consumer.phone)
  ) {
    return null;
  }
  return { occurredAt, status: item.consumer.consentStatus };
}

function consumerIdentityKeys(
  item: Extract<NormalizedProspect, { mode: "B2C" }>,
) {
  return [
    ...(item.consumer.email
      ? [`email:${item.consumer.email.trim().toLowerCase()}`]
      : []),
    ...(item.consumer.phone ? [`phone:${item.consumer.phone}`] : []),
  ];
}

/**
 * Pull trusted negative permission events out before ordinary deduplication.
 * Events are ordered oldest-to-newest so the latest state wins regardless of
 * provider ordering, while every trusted event is still reconciled/audited.
 */
export function prioritizeConsumerRevocations(
  items: NormalizedProspect[],
  now = new Date(),
) {
  const trusted = items
    .flatMap((item) => {
      if (item.mode !== "B2C") return [];
      const event = trustedNegativePermissionEvent(item, now);
      return event ? [{ item, event }] : [];
    })
    .sort(
      (left, right) =>
        left.event.occurredAt.getTime() - right.event.occurredAt.getTime(),
    );
  const negativeItems = new Set(trusted.map(({ item }) => item));
  const withdrawnIdentities = new Set(
    trusted.flatMap(({ item }) => consumerIdentityKeys(item)),
  );
  const candidates = items.filter((item) => {
    if (item.mode !== "B2C") return true;
    if (negativeItems.has(item)) return false;
    return !consumerIdentityKeys(item).some((key) =>
      withdrawnIdentities.has(key),
    );
  });
  return {
    revocations: trusted.map(({ item }) => item),
    candidates,
  };
}

async function reconcileConsumerRevocation(input: {
  item: Extract<NormalizedProspect, { mode: "B2C" }>;
  search: Awaited<ReturnType<typeof db.search.findUniqueOrThrow>>;
  dataSourceRecordId: string;
}) {
  const event = trustedNegativePermissionEvent(input.item);
  if (!event) return false;
  const emailHash = input.item.consumer.email
    ? hashEmail(input.item.consumer.email)
    : undefined;
  const phoneHash = input.item.consumer.phone
    ? hashPhone(input.item.consumer.phone)
    : undefined;
  const identity: Prisma.ConsumerProspectWhereInput[] = [
    ...(emailHash ? [{ emailHash }] : []),
    ...(phoneHash ? [{ phoneHash }] : []),
  ];
  const outcome = await db.$transaction(async (tx) => {
    const matches = await tx.consumerProspect.findMany({
      where: {
        workspaceId: input.search.workspaceId,
        OR: identity,
      },
      select: { id: true },
    });
    const identityConflict = matches.length > 1;
    const consumerIds = matches.map((item) => item.id);
    const activeSuppression = await tx.suppressionEntry.findFirst({
      where: {
        workspaceId: input.search.workspaceId,
        OR: [
          ...(emailHash ? [{ emailHash }] : []),
          ...(phoneHash ? [{ phoneHash }] : []),
        ],
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }],
      },
      select: { id: true },
    });
    if (!activeSuppression) {
      await tx.suppressionEntry.create({
        data: {
          workspaceId: input.search.workspaceId,
          type: "OPT_OUT",
          emailHash,
          phoneHash,
          reason: `Permission ${event.status.toLowerCase()} event`,
          source: input.item.consumer.consentSource!,
        },
      });
    }
    if (!consumerIds.length) {
      return {
        identityConflict,
        affectedResults: 0,
        consumerId: null,
      };
    }
    const resultIds = await tx.searchResult.findMany({
      where: {
        consumerId: { in: consumerIds },
        search: { workspaceId: input.search.workspaceId },
      },
      select: { id: true },
    });
    await tx.outreach.deleteMany({
      where: { searchResultId: { in: resultIds.map((item) => item.id) } },
    });
    await tx.consentRecord.updateMany({
      where: {
        consumerId: { in: consumerIds },
        status: { in: ["GRANTED", "DENIED", "WITHDRAWN"] },
        OR: [
          { purpose: input.search.purpose },
          { source: input.item.consumer.consentSource! },
        ],
      },
      data: { status: event.status, withdrawnAt: event.occurredAt },
    });
    await tx.consumerProspect.updateMany({
      where: { id: { in: consumerIds } },
      data: {
        consentStatus: event.status,
        consentCapturedAt: event.occurredAt,
        encryptedEmail: emailHash ? null : undefined,
        emailMasked: emailHash ? null : undefined,
        emailVerification: emailHash ? "UNVERIFIED" : undefined,
        encryptedPhone: phoneHash ? null : undefined,
        phoneMasked: phoneHash ? null : undefined,
        phoneVerification: phoneHash ? "UNVERIFIED" : undefined,
      },
    });
    const affected = await tx.searchResult.updateMany({
      where: {
        consumerId: { in: consumerIds },
        search: { workspaceId: input.search.workspaceId },
      },
      data: { isSuppressed: true, score: 0, recommendedChannel: null },
    });
    const existingEvidence = await tx.evidence.findMany({
      where: {
        searchId: input.search.id,
        dataSourceRecordId: input.dataSourceRecordId,
        consumerId: { in: consumerIds },
        field: "permission_revocation",
      },
      select: { consumerId: true },
    });
    const evidenced = new Set(
      existingEvidence.flatMap((item) =>
        item.consumerId ? [item.consumerId] : [],
      ),
    );
    const missingEvidence = consumerIds
      .filter((consumerId) => !evidenced.has(consumerId))
      .map((consumerId) => ({
        workspaceId: input.search.workspaceId,
        searchId: input.search.id,
        dataSourceRecordId: input.dataSourceRecordId,
        consumerId,
        subjectType: "CONSUMER" as const,
        sourceType: input.item.provenance.sourceType,
        provider: input.item.provenance.provider,
        sourceUrl: input.item.sourceUrl,
        field: "permission_revocation",
        valueHash: hashIdentifier(input.item.consumer.consentProofReference!),
        confidence: 95,
        observedAt: event.occurredAt,
        expiresAt: input.search.retentionUntil,
      }));
    if (missingEvidence.length) {
      await tx.evidence.createMany({ data: missingEvidence });
    }
    return {
      identityConflict,
      affectedResults: affected.count,
      consumerId: consumerIds[0] ?? null,
    };
  });
  await writeAudit({
    workspaceId: input.search.workspaceId,
    actorId: input.search.createdById,
    action: "consent.negative_event.reconciled",
    entityType: "consumer",
    entityId: outcome.consumerId ?? undefined,
    metadata: {
      status: event.status,
      source: input.item.consumer.consentSource,
      affectedResults: outcome.affectedResults,
      identityConflict: outcome.identityConflict,
    },
  });
  return true;
}

async function cleanupFailedProviderArtifacts(
  searchId: string,
  provenance?: SourceProvenance,
) {
  const records = await db.dataSourceRecord.findMany({
    where: { searchId },
    select: {
      id: true,
      provider: true,
      datasetId: true,
      externalId: true,
    },
  });
  const candidates = [...records];
  if (
    provenance?.provider === "apify" &&
    !candidates.some(
      (item) =>
        item.datasetId === provenance.datasetId &&
        item.externalId === provenance.runId,
    )
  ) {
    candidates.push({
      id: "",
      provider: "apify",
      datasetId: provenance.datasetId ?? null,
      externalId: provenance.runId ?? null,
    });
  }
  const removableIds: string[] = [];
  let providerCleanupFailures = 0;
  const apify = env.APIFY_TOKEN
    ? new ApifyClient({ token: env.APIFY_TOKEN })
    : null;
  for (const source of candidates) {
    if (source.provider !== "apify") {
      if (source.id) removableIds.push(source.id);
      continue;
    }
    if (!apify) {
      providerCleanupFailures += 1;
      continue;
    }
    const removal = await removeApifySourceArtifacts(apify, source);
    if (removal.complete) {
      if (source.id) removableIds.push(source.id);
    } else {
      providerCleanupFailures += 1;
    }
  }
  return { removableIds, providerCleanupFailures };
}

async function updateJob(
  jobId: string,
  runToken: string,
  stage: Prisma.SearchJobUpdateInput["stage"],
  progress: number,
) {
  const updated = await db.searchJob.updateMany({
    where: { id: jobId, status: "RUNNING", runToken },
    data: {
      stage,
      progress,
      heartbeatAt: new Date(),
      startedAt: progress <= 5 ? new Date() : undefined,
    },
  });
  if (!updated.count) throw new JobLeaseLostError("Search job lease lost");
}

async function assertJobLeaseOwner(jobId: string, runToken: string) {
  const owned = await db.searchJob.updateMany({
    where: { id: jobId, status: "RUNNING", runToken },
    data: { heartbeatAt: new Date() },
  });
  if (!owned.count) throw new JobLeaseLostError("Search job lease lost");
}

async function isSuppressed(
  workspaceId: string,
  email?: string,
  phone?: string,
) {
  const emailHash = email ? hashEmail(email) : undefined;
  const phoneHash = phone ? hashPhone(phone) : undefined;
  if (!emailHash && !phoneHash) return false;
  const identity: Prisma.SuppressionEntryWhereInput[] = [];
  if (emailHash) identity.push({ emailHash });
  if (phoneHash) identity.push({ phoneHash });
  return Boolean(
    await db.suppressionEntry.findFirst({
      where: {
        workspaceId,
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }],
        OR: identity,
      },
      select: { id: true },
    }),
  );
}

async function ensureB2BEvidence(input: {
  item: Extract<NormalizedProspect, { mode: "B2B" }>;
  search: Awaited<ReturnType<typeof db.search.findUniqueOrThrow>>;
  dataSourceRecordId: string;
  companyId: string;
  contactId: string;
  tx?: Prisma.TransactionClient;
}) {
  const client = input.tx ?? db;
  const required = [
    "company",
    "role",
    ...(input.item.contact.email ? ["email"] : []),
  ];
  const researchEvidence = (input.item.research?.evidence ?? []).map(
    (evidence) => ({
      field: `research.${evidence.kind.toLowerCase()}.${evidence.id}`,
      subjectType: "COMPANY" as const,
      provider: evidence.actorId
        ? `apify:${evidence.actorId}`
        : input.item.provenance.provider,
      sourceUrl: evidence.sourceUrl,
      excerpt: evidence.excerpt,
      valueHash: hashIdentifier(
        `${evidence.id}:${evidence.excerpt}:${evidence.observedAt}`,
      ),
      confidence: evidence.confidence,
      observedAt: new Date(evidence.observedAt),
    }),
  );
  const expectedFields = [
    ...required,
    ...researchEvidence.map((evidence) => evidence.field),
  ];
  const existing = await client.evidence.findMany({
    where: {
      searchId: input.search.id,
      dataSourceRecordId: input.dataSourceRecordId,
      contactId: input.contactId,
      field: { in: expectedFields },
    },
    select: { field: true },
  });
  const present = new Set(existing.map((item) => item.field));
  const missing = required.filter((field) => !present.has(field));
  const missingResearch = researchEvidence.filter(
    (evidence) => !present.has(evidence.field),
  );
  if (!missing.length && !missingResearch.length) return;
  await client.evidence.createMany({
    data: [
      ...missing.map((field) => ({
        workspaceId: input.search.workspaceId,
        searchId: input.search.id,
        dataSourceRecordId: input.dataSourceRecordId,
        companyId: input.companyId,
        contactId: input.contactId,
        subjectType: "PROFESSIONAL_CONTACT" as const,
        sourceType: input.item.provenance.sourceType,
        provider: input.item.provenance.provider,
        sourceUrl: input.item.sourceUrl,
        field,
        valueHash: hashIdentifier(`${field}:${input.item.rawHash}`),
        confidence: field === "email" ? 75 : 88,
        observedAt: new Date(input.item.provenance.collectedAt),
        expiresAt: input.search.retentionUntil,
      })),
      ...missingResearch.map((evidence) => ({
        workspaceId: input.search.workspaceId,
        searchId: input.search.id,
        dataSourceRecordId: input.dataSourceRecordId,
        companyId: input.companyId,
        contactId: input.contactId,
        subjectType: evidence.subjectType,
        sourceType: input.item.provenance.sourceType,
        provider: evidence.provider,
        sourceUrl: evidence.sourceUrl,
        field: evidence.field,
        valueHash: evidence.valueHash,
        excerpt: evidence.excerpt,
        confidence: evidence.confidence,
        observedAt: evidence.observedAt,
        expiresAt: input.search.retentionUntil,
      })),
    ],
  });
}

async function ensureB2CEvidence(input: {
  item: Extract<NormalizedProspect, { mode: "B2C" }>;
  search: Awaited<ReturnType<typeof db.search.findUniqueOrThrow>>;
  dataSourceRecordId: string;
  consumerId: string;
  proofValid: boolean;
  tx?: Prisma.TransactionClient;
}) {
  const client = input.tx ?? db;
  const exists = await client.evidence.findFirst({
    where: {
      searchId: input.search.id,
      dataSourceRecordId: input.dataSourceRecordId,
      consumerId: input.consumerId,
      provider: input.item.provenance.provider,
      field: "permission_and_declared_interests",
    },
    select: { id: true },
  });
  if (exists) return;
  await client.evidence.create({
    data: {
      workspaceId: input.search.workspaceId,
      searchId: input.search.id,
      dataSourceRecordId: input.dataSourceRecordId,
      consumerId: input.consumerId,
      subjectType: "CONSUMER",
      sourceType: input.item.provenance.sourceType,
      provider: input.item.provenance.provider,
      sourceUrl: input.item.sourceUrl,
      field: "permission_and_declared_interests",
      valueHash: hashIdentifier(input.item.rawHash),
      confidence: input.proofValid ? 90 : 40,
      observedAt: new Date(input.item.provenance.collectedAt),
      expiresAt: input.search.retentionUntil,
    },
  });
}

async function storeB2B(input: {
  item: Extract<NormalizedProspect, { mode: "B2B" }>;
  search: Awaited<ReturnType<typeof db.search.findUniqueOrThrow>>;
  dataSourceRecordId: string;
  deterministic: ScoreResult;
  analysis: ProspectAnalysis;
  rank: number;
}) {
  const { item, search, deterministic, analysis } = input;
  if (
    await isSuppressed(
      search.workspaceId,
      item.contact.email,
      item.contact.phone,
    )
  ) {
    return null;
  }
  if (
    !meetsScoreThreshold(
      analysis.score,
      (search.filters ?? {}) as Record<string, unknown>,
    )
  ) {
    throw new ScoreThresholdError();
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await db.$transaction(async (tx) => {
        let company = await tx.company.findFirst({
          where: {
            workspaceId: search.workspaceId,
            ...(item.company.domain
              ? { normalizedDomain: item.company.domain }
              : {
                  normalizedName: item.company.normalizedName,
                  normalizedDomain: null,
                }),
          },
        });
        const companyData = {
          name: item.company.name,
          normalizedName: item.company.normalizedName,
          domain: item.company.domain,
          normalizedDomain: item.company.domain,
          website: item.company.website,
          linkedinUrl: item.company.linkedinUrl,
          description: item.company.description,
          industry: item.company.industry,
          location: item.company.location,
          country: item.company.country,
          city: item.company.city,
          employeeCount: item.company.employeeCount,
          employeeRange: item.company.employeeRange,
          revenueRange: item.company.revenueRange,
          foundedYear: item.company.foundedYear,
          technologies: item.company.technologies,
          keywords: item.company.keywords,
          fundingStage: item.company.fundingStage,
          isHiring: item.company.isHiring,
          websiteQuality: item.company.websiteQuality,
          lastVerifiedAt: new Date(item.provenance.collectedAt),
        };
        company = company
          ? await tx.company.update({
              where: { id: company.id },
              data: companyData,
            })
          : await tx.company.create({
              data: { workspaceId: search.workspaceId, ...companyData },
            });

        const emailHash = item.contact.email
          ? hashEmail(item.contact.email)
          : undefined;
        const phoneHash = item.contact.phone
          ? hashPhone(item.contact.phone)
          : undefined;
        const [contactByEmail, contactByPhone, contactByLinkedin] =
          await Promise.all([
            emailHash
              ? tx.contact.findFirst({
                  where: { workspaceId: search.workspaceId, emailHash },
                })
              : null,
            phoneHash
              ? tx.contact.findFirst({
                  where: { workspaceId: search.workspaceId, phoneHash },
                })
              : null,
            item.contact.linkedinUrl
              ? tx.contact.findFirst({
                  where: {
                    workspaceId: search.workspaceId,
                    linkedinUrl: item.contact.linkedinUrl,
                  },
                })
              : null,
          ]);
        const stableContacts = [
          contactByEmail,
          contactByPhone,
          contactByLinkedin,
        ].filter((value): value is NonNullable<typeof value> => Boolean(value));
        if (new Set(stableContacts.map((value) => value.id)).size > 1) {
          throw new IdentityConflictError();
        }
        let contact = stableContacts[0] ?? null;
        if (!emailHash && !phoneHash && !item.contact.linkedinUrl) {
          contact = await tx.contact.findFirst({
            where: {
              workspaceId: search.workspaceId,
              companyId: company.id,
              normalizedName: item.contact.normalizedName,
              emailHash: null,
              phoneHash: null,
              linkedinUrl: null,
            },
          });
        }
        const acceptEmail = Boolean(
          emailHash && (!contact?.emailHash || contact.emailHash === emailHash),
        );
        const acceptPhone = Boolean(
          phoneHash && (!contact?.phoneHash || contact.phoneHash === phoneHash),
        );
        const acceptLinkedin = Boolean(
          item.contact.linkedinUrl &&
          (!contact?.linkedinUrl ||
            contact.linkedinUrl === item.contact.linkedinUrl),
        );
        const contactData = {
          companyId: company.id,
          firstName: item.contact.firstName,
          lastName: item.contact.lastName,
          fullName: item.contact.fullName,
          normalizedName: item.contact.normalizedName,
          title: item.contact.title,
          seniority: item.contact.seniority,
          location: item.contact.location,
          country: item.contact.country,
          linkedinUrl: acceptLinkedin ? item.contact.linkedinUrl : undefined,
          encryptedEmail:
            acceptEmail && item.contact.email
              ? encryptSensitive(item.contact.email)
              : undefined,
          emailHash: acceptEmail ? emailHash : undefined,
          emailMasked:
            acceptEmail && item.contact.email
              ? maskEmail(item.contact.email)
              : undefined,
          emailVerification: acceptEmail ? ("LIKELY" as const) : undefined,
          encryptedPhone:
            acceptPhone && item.contact.phone
              ? encryptSensitive(item.contact.phone)
              : undefined,
          phoneHash: acceptPhone ? phoneHash : undefined,
          phoneMasked:
            acceptPhone && item.contact.phone
              ? maskPhone(item.contact.phone)
              : undefined,
          phoneVerification: acceptPhone ? ("LIKELY" as const) : undefined,
          decisionMakerConfidence:
            /founder|owner|chief|ceo|vp|director|head/i.test(
              item.contact.title ?? "",
            )
              ? 90
              : 62,
          lastVerifiedAt: new Date(item.provenance.collectedAt),
          retentionUntil:
            contact && contact.retentionUntil > search.retentionUntil
              ? contact.retentionUntil
              : search.retentionUntil,
        };
        contact = contact
          ? await tx.contact.update({
              where: { id: contact.id },
              data: contactData,
            })
          : await tx.contact.create({
              data: { workspaceId: search.workspaceId, ...contactData },
            });

        const existingResult = await tx.searchResult.findFirst({
          where: { searchId: search.id, contactId: contact.id },
        });
        if (existingResult) {
          await ensureB2BEvidence({
            item,
            search,
            dataSourceRecordId: input.dataSourceRecordId,
            companyId: company.id,
            contactId: contact.id,
            tx,
          });
          return { result: existingResult, created: false };
        }
        const result = await tx.searchResult.create({
          data: {
            searchId: search.id,
            companyId: company.id,
            contactId: contact.id,
            score: analysis.score,
            rank: input.rank,
            buyingIntent: analysis.buyingIntent,
            summary: analysis.summary,
            reasons: analysis.reasons,
            suggestedOffer: analysis.suggestedOffer,
            recommendedChannel:
              analysis.recommendedChannel === "REVIEW_REQUIRED"
                ? undefined
                : analysis.recommendedChannel,
            scoreBreakdown: deterministic.breakdown,
            profileSnapshot: createProfileSnapshot(
              item,
            ) as Prisma.InputJsonValue,
            confidence: analysis.decisionMakerConfidence,
            isSuppressed: false,
            retentionUntil: search.retentionUntil,
            aiResponses: {
              create: {
                purpose: "PROSPECT_ANALYSIS",
                model: analysis.model,
                promptVersion: analysis.promptVersion,
                inputHash: hashIdentifier(`${search.id}:${item.rawHash}`),
                output: {
                  score: analysis.score,
                  buyingIntent: analysis.buyingIntent,
                  summary: analysis.summary,
                  reasons: analysis.reasons,
                  suggestedOffer: analysis.suggestedOffer,
                  recommendedChannel: analysis.recommendedChannel,
                  scoreBreakdown: analysis.scoreBreakdown,
                  painPoints: analysis.painPoints,
                  buyingSignals: analysis.buyingSignals,
                  recommendedServices: analysis.recommendedServices,
                  confidence: analysis.confidence,
                  ...(analysis.fallbackReason
                    ? { fallbackReason: analysis.fallbackReason }
                    : {}),
                },
                tokensInput: analysis.tokensInput,
                tokensOutput: analysis.tokensOutput,
                latencyMs: analysis.latencyMs,
              },
            },
          },
        });
        await ensureB2BEvidence({
          item,
          search,
          dataSourceRecordId: input.dataSourceRecordId,
          companyId: company.id,
          contactId: contact.id,
          tx,
        });
        return { result, created: true };
      });
    } catch (error) {
      if (error instanceof IdentityConflictError) return null;
      if (isCanonicalIdentityRace(error) && attempt === 0) continue;
      throw error;
    }
  }
  return null;
}

async function storeB2C(input: {
  item: Extract<NormalizedProspect, { mode: "B2C" }>;
  search: Awaited<ReturnType<typeof db.search.findUniqueOrThrow>>;
  dataSourceRecordId: string;
  deterministic: ScoreResult;
  analysis: ProspectAnalysis;
  rank: number;
}) {
  const { item, search, deterministic, analysis } = input;
  const permission = evaluateConsumerPermission(item, search.lawfulBasis);
  if (
    search.lawfulBasis === "CONSENT" &&
    (!permission.proofValid ||
      !permissionHasReachableChannel(item, permission.channels))
  ) {
    return null;
  }
  if (
    await isSuppressed(
      search.workspaceId,
      item.consumer.email,
      item.consumer.phone,
    )
  ) {
    return null;
  }
  const emailHash = item.consumer.email
    ? hashEmail(item.consumer.email)
    : undefined;
  const phoneHash = item.consumer.phone
    ? hashPhone(item.consumer.phone)
    : undefined;
  const [consumerByEmail, consumerByPhone] = await Promise.all([
    emailHash
      ? db.consumerProspect.findFirst({
          where: { workspaceId: search.workspaceId, emailHash },
        })
      : null,
    phoneHash
      ? db.consumerProspect.findFirst({
          where: { workspaceId: search.workspaceId, phoneHash },
        })
      : null,
  ]);
  if (
    consumerByEmail &&
    consumerByPhone &&
    consumerByEmail.id !== consumerByPhone.id
  ) {
    return null;
  }
  let consumer = consumerByEmail ?? consumerByPhone ?? null;
  if (!emailHash && !phoneHash) {
    consumer = await db.consumerProspect.findFirst({
      where: {
        workspaceId: search.workspaceId,
        normalizedName: item.consumer.normalizedName,
        location: item.consumer.location,
        emailHash: null,
        phoneHash: null,
      },
    });
  }
  const acceptEmail = Boolean(
    emailHash && (!consumer?.emailHash || consumer.emailHash === emailHash),
  );
  const acceptPhone = Boolean(
    phoneHash && (!consumer?.phoneHash || consumer.phoneHash === phoneHash),
  );
  const storedPermissionChannels = permission.channels.filter(
    (channel) =>
      (channel === "EMAIL" && acceptEmail) ||
      ((channel === "PHONE" || channel === "WHATSAPP") && acceptPhone),
  );
  if (search.lawfulBasis === "CONSENT" && !storedPermissionChannels.length) {
    return null;
  }
  const safeItem: Extract<NormalizedProspect, { mode: "B2C" }> = {
    ...item,
    consumer: {
      ...item.consumer,
      consentStatus: permission.status,
      consentChannels: storedPermissionChannels,
      consentCapturedAt: permission.capturedAt?.toISOString(),
      consentExpiresAt: permission.expiresAt?.toISOString(),
    },
  };
  const consumerData = {
    displayName: safeItem.consumer.displayName,
    normalizedName: safeItem.consumer.normalizedName,
    ageBand: safeItem.consumer.ageBand,
    location: safeItem.consumer.location,
    country: safeItem.consumer.country,
    interests: safeItem.consumer.interests,
    encryptedEmail:
      acceptEmail && safeItem.consumer.email
        ? encryptSensitive(safeItem.consumer.email)
        : undefined,
    emailHash: acceptEmail ? emailHash : undefined,
    emailMasked:
      acceptEmail && safeItem.consumer.email
        ? maskEmail(safeItem.consumer.email)
        : undefined,
    emailVerification: acceptEmail ? ("LIKELY" as const) : undefined,
    encryptedPhone:
      acceptPhone && safeItem.consumer.phone
        ? encryptSensitive(safeItem.consumer.phone)
        : undefined,
    phoneHash: acceptPhone ? phoneHash : undefined,
    phoneMasked:
      acceptPhone && safeItem.consumer.phone
        ? maskPhone(safeItem.consumer.phone)
        : undefined,
    phoneVerification: acceptPhone ? ("LIKELY" as const) : undefined,
    consentStatus: permission.status,
    consentCapturedAt: permission.capturedAt,
    retentionUntil:
      consumer && consumer.retentionUntil > search.retentionUntil
        ? consumer.retentionUntil
        : search.retentionUntil,
  };
  if (consumer) {
    const existingResult = await db.searchResult.findFirst({
      where: { searchId: search.id, consumerId: consumer.id },
    });
    if (existingResult) {
      if (
        !meetsScoreThreshold(
          existingResult.score,
          (search.filters ?? {}) as Record<string, unknown>,
        )
      ) {
        throw new ScoreThresholdError();
      }
      await ensureB2CEvidence({
        item: safeItem,
        search,
        dataSourceRecordId: input.dataSourceRecordId,
        consumerId: consumer.id,
        proofValid: permission.proofValid,
      });
      return { result: existingResult, created: false };
    }
  }
  if (
    !meetsScoreThreshold(
      analysis.score,
      (search.filters ?? {}) as Record<string, unknown>,
    )
  ) {
    throw new ScoreThresholdError();
  }
  const consentCapturedAt = permission.capturedAt;
  const consentExpiresAt = permission.expiresAt;
  const consentProof = permission.proof;
  const lawfulBasis = search.lawfulBasis;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await db.$transaction(async (tx) => {
        const storedConsumer = consumer
          ? await tx.consumerProspect.update({
              where: { id: consumer.id },
              data: consumerData,
            })
          : await tx.consumerProspect.create({
              data: { workspaceId: search.workspaceId, ...consumerData },
            });
        const racedResult = await tx.searchResult.findFirst({
          where: { searchId: search.id, consumerId: storedConsumer.id },
        });
        if (racedResult) {
          await ensureB2CEvidence({
            item: safeItem,
            search,
            dataSourceRecordId: input.dataSourceRecordId,
            consumerId: storedConsumer.id,
            proofValid: permission.proofValid,
            tx,
          });
          return { result: racedResult, created: false };
        }
        if (
          permission.proofValid &&
          consentProof &&
          consentCapturedAt &&
          consentExpiresAt &&
          lawfulBasis === "CONSENT" &&
          storedPermissionChannels.length
        ) {
          await tx.consentRecord.createMany({
            data: storedPermissionChannels.map((channel) => ({
              workspaceId: search.workspaceId,
              consumerId: storedConsumer.id,
              status: "GRANTED",
              lawfulBasis,
              purpose: search.purpose,
              channel,
              source: consentProof.source,
              proofEncrypted: encryptSensitive(JSON.stringify(consentProof)),
              capturedAt: consentCapturedAt,
              expiresAt:
                consentExpiresAt < search.retentionUntil
                  ? consentExpiresAt
                  : search.retentionUntil,
            })),
          });
        }
        const result = await tx.searchResult.create({
          data: {
            searchId: search.id,
            consumerId: storedConsumer.id,
            score: analysis.score,
            rank: input.rank,
            buyingIntent: analysis.buyingIntent,
            summary: analysis.summary,
            reasons: analysis.reasons,
            suggestedOffer: analysis.suggestedOffer,
            recommendedChannel:
              analysis.recommendedChannel === "REVIEW_REQUIRED" ||
              !storedPermissionChannels.includes(analysis.recommendedChannel)
                ? undefined
                : analysis.recommendedChannel,
            scoreBreakdown: deterministic.breakdown,
            profileSnapshot: createProfileSnapshot(
              safeItem,
            ) as Prisma.InputJsonValue,
            confidence: deterministic.confidence,
            isSuppressed: false,
            retentionUntil: search.retentionUntil,
            aiResponses: {
              create: {
                purpose: "PROSPECT_ANALYSIS",
                model: analysis.model,
                promptVersion: analysis.promptVersion,
                inputHash: hashIdentifier(`${search.id}:${item.rawHash}`),
                output: {
                  score: analysis.score,
                  summary: analysis.summary,
                  reasons: analysis.reasons,
                  ...(analysis.fallbackReason
                    ? { fallbackReason: analysis.fallbackReason }
                    : {}),
                },
                tokensInput: analysis.tokensInput,
                tokensOutput: analysis.tokensOutput,
                latencyMs: analysis.latencyMs,
              },
            },
          },
        });
        await ensureB2CEvidence({
          item: safeItem,
          search,
          dataSourceRecordId: input.dataSourceRecordId,
          consumerId: storedConsumer.id,
          proofValid: permission.proofValid,
          tx,
        });
        return { result, created: true };
      });
    } catch (error) {
      if (!isCanonicalIdentityRace(error) || attempt > 0) throw error;
      const [racedByEmail, racedByPhone] = await Promise.all([
        emailHash
          ? db.consumerProspect.findFirst({
              where: { workspaceId: search.workspaceId, emailHash },
            })
          : null,
        phoneHash
          ? db.consumerProspect.findFirst({
              where: { workspaceId: search.workspaceId, phoneHash },
            })
          : null,
      ]);
      if (racedByEmail && racedByPhone && racedByEmail.id !== racedByPhone.id) {
        return null;
      }
      consumer = racedByEmail ?? racedByPhone ?? null;
      if (!consumer) throw error;
      if (consumer.retentionUntil > consumerData.retentionUntil) {
        consumerData.retentionUntil = consumer.retentionUntil;
      }
    }
  }
  return null;
}

async function findPersistedCandidate(
  searchId: string,
  item: NormalizedProspect,
) {
  const response = await db.aIResponse.findFirst({
    where: {
      purpose: "PROSPECT_ANALYSIS",
      inputHash: hashIdentifier(`${searchId}:${item.rawHash}`),
      searchResultId: { not: null },
    },
    select: {
      searchResult: {
        select: {
          id: true,
          searchId: true,
          companyId: true,
          contactId: true,
          consumerId: true,
          score: true,
          isSuppressed: true,
        },
      },
    },
  });
  return response?.searchResult?.searchId === searchId
    ? response.searchResult
    : null;
}

type PersistedCandidate = NonNullable<
  Awaited<ReturnType<typeof findPersistedCandidate>>
>;

type PreparedCandidate =
  | {
      disposition: "excluded";
      item: NormalizedProspect;
      reason: "suppressed" | "below_score_threshold";
    }
  | {
      disposition: "existing";
      item: NormalizedProspect;
      existing: PersistedCandidate;
    }
  | {
      disposition: "analyzed";
      item: NormalizedProspect;
      deterministic: ScoreResult;
      analysis: ProspectAnalysis;
    };

async function prepareCandidate(input: {
  item: NormalizedProspect;
  search: Awaited<ReturnType<typeof db.search.findUniqueOrThrow>>;
  analysisDeadlineAt: number;
}): Promise<PreparedCandidate> {
  const { item, search } = input;
  const email = item.mode === "B2B" ? item.contact.email : item.consumer.email;
  const phone = item.mode === "B2B" ? item.contact.phone : item.consumer.phone;
  if (await isSuppressed(search.workspaceId, email, phone)) {
    return { disposition: "excluded", item, reason: "suppressed" };
  }
  const existing = await findPersistedCandidate(search.id, item);
  if (existing) {
    if (
      existing.isSuppressed ||
      !meetsScoreThreshold(
        existing.score,
        (search.filters ?? {}) as Record<string, unknown>,
      )
    ) {
      return {
        disposition: "excluded",
        item,
        reason: existing.isSuppressed ? "suppressed" : "below_score_threshold",
      };
    }
    return { disposition: "existing", item, existing };
  }
  const analysisItem: NormalizedProspect =
    item.mode === "B2C"
      ? (() => {
          const permission = evaluateConsumerPermission(
            item,
            search.lawfulBasis,
          );
          return {
            ...item,
            consumer: {
              ...item.consumer,
              consentStatus: permission.status,
              consentCapturedAt: permission.capturedAt?.toISOString(),
              consentExpiresAt: permission.expiresAt?.toISOString(),
              consentChannels: permission.channels,
            },
          };
        })()
      : item;
  const deterministic = scoreProspect(analysisItem, {
    query: search.query,
    filters: (search.filters ?? {}) as Record<string, unknown>,
  });
  const analysis = await analyzeProspect(
    {
      item: analysisItem,
      deterministic,
      query: search.query,
      purpose: search.purpose,
      workspaceId: search.workspaceId,
      userId: search.createdById,
    },
    {
      deadlineAt: input.analysisDeadlineAt,
      forceFallback: Date.now() >= input.analysisDeadlineAt,
    },
  );
  if (
    !meetsScoreThreshold(
      analysis.score,
      (search.filters ?? {}) as Record<string, unknown>,
    )
  ) {
    return {
      disposition: "excluded",
      item,
      reason: "below_score_threshold",
    };
  }
  return { disposition: "analyzed", item, deterministic, analysis };
}

async function attachExistingEvidence(input: {
  prepared: Extract<PreparedCandidate, { disposition: "existing" }>;
  search: Awaited<ReturnType<typeof db.search.findUniqueOrThrow>>;
  dataSourceRecordId: string;
}) {
  const { prepared, search } = input;
  if (
    prepared.item.mode === "B2B" &&
    prepared.existing.companyId &&
    prepared.existing.contactId
  ) {
    await ensureB2BEvidence({
      item: prepared.item,
      search,
      dataSourceRecordId: input.dataSourceRecordId,
      companyId: prepared.existing.companyId,
      contactId: prepared.existing.contactId,
    });
    return;
  }
  if (prepared.item.mode === "B2C" && prepared.existing.consumerId) {
    await ensureB2CEvidence({
      item: prepared.item,
      search,
      dataSourceRecordId: input.dataSourceRecordId,
      consumerId: prepared.existing.consumerId,
      proofValid: evaluateConsumerPermission(prepared.item, search.lawfulBasis)
        .proofValid,
    });
  }
}

export async function processSearchJob(payload: {
  searchId: string;
  jobId: string;
  attempt?: number;
  maxAttempts?: number;
}) {
  const search = await db.search.findUniqueOrThrow({
    where: { id: payload.searchId },
  });
  const currentJob = await db.searchJob.findUniqueOrThrow({
    where: { id: payload.jobId },
  });
  let fetchedProvenance: SourceProvenance | undefined;
  if (currentJob.status === "COMPLETE" || search.status === "COMPLETE") {
    return {
      resultCount: await db.searchResult.count({
        where: { searchId: search.id },
      }),
    };
  }
  const runToken = randomUUID();
  const claimed = await db.searchJob.updateMany({
    where: {
      id: payload.jobId,
      searchId: payload.searchId,
      OR: [
        { status: { in: ["QUEUED", "RETRYING"] } },
        {
          status: "RUNNING",
          heartbeatAt: {
            lt: new Date(Date.now() - env.SEARCH_JOB_STALE_AFTER_MS),
          },
        },
      ],
    },
    data: {
      status: "RUNNING",
      runToken,
      attempt: payload.attempt ?? currentJob.attempt,
      heartbeatAt: new Date(),
      startedAt: currentJob.startedAt ?? new Date(),
    },
  });
  if (!claimed.count) {
    throw new Error("Search job is already running or is in a terminal state");
  }
  const lease = startJobLease(payload.jobId, runToken);
  try {
    await db.search.update({
      where: { id: search.id },
      data: { status: "RUNNING" },
    });
    await updateJob(payload.jobId, runToken, "SEARCHING_COMPANIES", 5);
    const providerTargetCount = candidateCollectionTarget(
      search.targetCount,
      (search.filters ?? {}) as Record<string, unknown>,
    );
    const source = await provider().search({
      workspaceId: search.workspaceId,
      mode: search.mode,
      query: search.query,
      purpose: search.purpose,
      lawfulBasis: search.lawfulBasis ?? undefined,
      audienceSource:
        search.audienceSource === "FIRST_PARTY_UPLOAD" ||
        search.audienceSource === "PERMISSIONED_PARTNER"
          ? search.audienceSource
          : undefined,
      audienceSourceReference: search.audienceSourceReference ?? undefined,
      jurisdiction: search.jurisdiction ?? undefined,
      filters: (search.filters ?? {}) as Record<string, unknown>,
      targetCount: providerTargetCount,
      checkpoint:
        currentJob.provider === "apify" &&
        currentJob.externalRunId &&
        currentJob.externalDatasetId
          ? {
              provider: "apify",
              runId: currentJob.externalRunId,
              datasetId: currentJob.externalDatasetId,
            }
          : undefined,
    });
    fetchedProvenance = source.provenance;
    if (source.provenance.provider === "apify") {
      const checkpointed = await db.searchJob.updateMany({
        where: { id: payload.jobId, status: "RUNNING", runToken },
        data: {
          externalRunId: source.provenance.runId,
          externalDatasetId: source.provenance.datasetId,
          heartbeatAt: new Date(),
        },
      });
      if (!checkpointed.count)
        throw new JobLeaseLostError("Search job lease lost");
    }
    const sourcePayloadHash = hashIdentifier(
      [
        search.id,
        source.provenance.provider,
        source.provenance.actorId,
        source.provenance.runId,
        source.provenance.datasetId,
      ]
        .filter(Boolean)
        .join(":"),
    );
    let dataSourceRecord = await db.dataSourceRecord.findFirst({
      where: {
        searchId: search.id,
        provider: source.provenance.provider,
        payloadHash: sourcePayloadHash,
      },
      select: { id: true },
    });
    if (!dataSourceRecord) {
      dataSourceRecord = await db.dataSourceRecord.create({
        data: {
          workspaceId: search.workspaceId,
          searchId: search.id,
          subjectType:
            search.mode === "B2B" ? "PROFESSIONAL_CONTACT" : "CONSUMER",
          sourceType: source.provenance.sourceType,
          provider: source.provenance.provider,
          externalId: source.provenance.runId,
          sourceUrl: source.provenance.sourceUrl,
          actorId: source.provenance.actorId,
          actorCreator: source.provenance.actorCreator,
          permissionReview: source.provenance.permissionReview as
            Prisma.InputJsonValue | undefined,
          datasetId: source.provenance.datasetId,
          termsVersion: source.provenance.permissionReview?.termsVersion,
          collectedAt: new Date(source.provenance.collectedAt),
          permittedPurpose: search.purpose,
          retentionUntil: search.retentionUntil,
          payloadHash: sourcePayloadHash,
        },
      });
    }
    await updateJob(payload.jobId, runToken, "NORMALIZING", 35);
    const exclusionReasons: Record<string, number> = {};
    const parsedItems = source.items
      .map((raw) => normalizeProspect(raw, search.mode, source.provenance))
      .filter((item): item is NormalizedProspect => Boolean(item));
    const prioritized = prioritizeConsumerRevocations(parsedItems);
    for (const item of prioritized.revocations) {
      await reconcileConsumerRevocation({
        item,
        search,
        dataSourceRecordId: dataSourceRecord.id,
      });
      exclusionReasons.permission_negative_event =
        (exclusionReasons.permission_negative_event ?? 0) + 1;
    }
    if (prioritized.candidates.length < parsedItems.length) {
      exclusionReasons.permission_negative_identity =
        parsedItems.length -
        prioritized.candidates.length -
        prioritized.revocations.length;
    }
    const deduped = dedupeProspects(prioritized.candidates);
    const normalized: NormalizedProspect[] = [];
    for (const item of deduped) {
      const filterDecision = structuredFilterDecision(
        item,
        (search.filters ?? {}) as Record<string, unknown>,
      );
      if (!filterDecision.eligible) {
        for (const reason of filterDecision.reasons) {
          const key = `filter_${reason}`;
          exclusionReasons[key] = (exclusionReasons[key] ?? 0) + 1;
        }
        continue;
      }
      if (item.mode === "B2C") {
        const screening = screenConsumerRecord(item);
        if (!screening.eligible) {
          exclusionReasons[screening.reason] =
            (exclusionReasons[screening.reason] ?? 0) + 1;
          continue;
        }
        const permission = evaluateConsumerPermission(item, search.lawfulBasis);
        if (
          !permission.proofValid ||
          !permissionHasReachableChannel(item, permission.channels)
        ) {
          exclusionReasons.invalid_or_unusable_consent =
            (exclusionReasons.invalid_or_unusable_consent ?? 0) + 1;
          continue;
        }
      }
      normalized.push(item);
    }
    await updateJob(payload.jobId, runToken, "ENRICHING", 55);
    const existingRows = await db.searchResult.findMany({
      where: { searchId: search.id },
      select: { id: true },
      take: search.targetCount + 1,
    });
    const resultBudget = new ResultBudget(
      search.targetCount,
      existingRows.map((result) => result.id),
    );
    const analysisDeadlineAt = Date.now() + env.SEARCH_ANALYSIS_BUDGET_MS;
    let processed = 0;
    let aiSucceeded = 0;
    let aiFallback = 0;
    let aiBudgetFallback = 0;
    const companyIntelligenceQueue: Array<
      Parameters<typeof persistCompanyIntelligence>[0]
    > = [];
    for (const window of orderedWindows(
      normalized,
      env.OPENROUTER_ANALYSIS_WINDOW_SIZE,
    )) {
      if (resultBudget.full) break;
      lease.assertActive();
      const preparedWindow = await mapConcurrentOrdered(
        window.items,
        env.OPENROUTER_SCORING_CONCURRENCY,
        (item) => prepareCandidate({ item, search, analysisDeadlineAt }),
      );
      for (const prepared of preparedWindow) {
        if (resultBudget.full) break;
        lease.assertActive();
        processed += 1;
        if (prepared.disposition === "excluded") {
          exclusionReasons[prepared.reason] =
            (exclusionReasons[prepared.reason] ?? 0) + 1;
          continue;
        }
        if (prepared.disposition === "existing") {
          await attachExistingEvidence({
            prepared,
            search,
            dataSourceRecordId: dataSourceRecord.id,
          });
          resultBudget.add(prepared.existing.id);
          continue;
        }
        if (prepared.analysis.usedFallback) {
          aiFallback += 1;
          if (prepared.analysis.fallbackReason === "budget_exhausted") {
            aiBudgetFallback += 1;
          }
        } else {
          aiSucceeded += 1;
        }
        let outcome;
        try {
          outcome =
            prepared.item.mode === "B2B"
              ? await storeB2B({
                  item: prepared.item,
                  search,
                  dataSourceRecordId: dataSourceRecord.id,
                  deterministic: prepared.deterministic,
                  analysis: prepared.analysis,
                  rank: resultBudget.count + 1,
                })
              : await storeB2C({
                  item: prepared.item,
                  search,
                  dataSourceRecordId: dataSourceRecord.id,
                  deterministic: prepared.deterministic,
                  analysis: prepared.analysis,
                  rank: resultBudget.count + 1,
                });
        } catch (error) {
          if (error instanceof ScoreThresholdError) {
            exclusionReasons.below_score_threshold =
              (exclusionReasons.below_score_threshold ?? 0) + 1;
            continue;
          }
          throw error;
        }
        if (outcome) {
          if (prepared.item.mode === "B2B" && outcome.result.companyId) {
            companyIntelligenceQueue.push({
              workspaceId: search.workspaceId,
              companyId: outcome.result.companyId,
              searchResultId: outcome.result.id,
              item: prepared.item,
              deterministic: prepared.deterministic,
              analysis: prepared.analysis,
              query: search.query,
              purpose: search.purpose,
              userId: search.createdById,
              deadlineAt: analysisDeadlineAt,
            });
          }
          if (!resultBudget.add(outcome.result.id)) {
            throw new Error("Delivered result count exceeds the target limit");
          }
        } else {
          exclusionReasons.identity_or_permission_conflict =
            (exclusionReasons.identity_or_permission_conflict ?? 0) + 1;
        }
      }
      await updateJob(
        payload.jobId,
        runToken,
        "SCORING",
        analysisStageProgress({
          processed,
          eligible: normalized.length,
          delivered: resultBudget.count,
          target: search.targetCount,
        }),
      );
    }
    if (companyIntelligenceQueue.length) {
      await updateJob(payload.jobId, runToken, "PREPARING_RESULTS", 92);
      await mapConcurrentOrdered(
        companyIntelligenceQueue,
        2,
        async (companyInput) => {
          await persistCompanyIntelligence(companyInput);
          return true;
        },
      );
    }
    const count = await db.searchResult.count({
      where: { searchId: search.id },
    });
    await db.$transaction(
      async (tx) => {
        const freshSearch = await tx.search.findUniqueOrThrow({
          where: { id: search.id },
        });
        if (freshSearch.chargedAt || freshSearch.status === "COMPLETE") return;
        const jobClaim = await tx.searchJob.updateMany({
          where: {
            id: payload.jobId,
            searchId: search.id,
            status: "RUNNING",
            runToken,
          },
          data: {
            status: "COMPLETE",
            stage: "COMPLETE",
            progress: 100,
            completedAt: new Date(),
            heartbeatAt: new Date(),
            runToken: null,
            metrics: {
              received: source.items.length,
              requested: search.targetCount,
              candidateTarget: providerTargetCount,
              deduplicated: deduped.length,
              eligible: normalized.length,
              processed,
              stored: count,
              analysis: {
                succeeded: aiSucceeded,
                fallback: aiFallback,
                budgetFallback: aiBudgetFallback,
              },
              exclusionReasons,
            },
          },
        });
        if (!jobClaim.count) {
          throw new JobLeaseLostError("Search job lease lost before charging");
        }
        if (
          count > freshSearch.targetCount ||
          count > freshSearch.reservedCredits
        ) {
          throw new Error(
            "Delivered result count exceeds the reserved credit limit",
          );
        }
        const before = await tx.workspace.findUniqueOrThrow({
          where: { id: search.workspaceId },
          select: { creditBalance: true, creditReserved: true },
        });
        if (
          before.creditBalance < count ||
          before.creditReserved < freshSearch.reservedCredits
        ) {
          throw new Error("Credit invariant would be violated");
        }
        const workspace = await tx.workspace.update({
          where: { id: search.workspaceId },
          data: {
            creditReserved: { decrement: freshSearch.reservedCredits },
            creditBalance: { decrement: count },
          },
        });
        await tx.creditLedger.create({
          data: {
            workspaceId: search.workspaceId,
            userId: search.createdById,
            type: "SEARCH_CHARGE",
            amount: -count,
            balanceAfter: workspace.creditBalance,
            referenceType: "search",
            referenceId: search.id,
            idempotencyKey: `search:${search.id}:charge`,
            description: `${count} prospect records delivered`,
          },
        });
        if (freshSearch.reservedCredits > count) {
          await tx.creditLedger.create({
            data: {
              workspaceId: search.workspaceId,
              userId: search.createdById,
              type: "RESERVATION_RELEASE",
              amount: 0,
              balanceAfter: workspace.creditBalance,
              referenceType: "search",
              referenceId: search.id,
              idempotencyKey: `search:${search.id}:release`,
              description: `${freshSearch.reservedCredits - count} unused reserved credits released`,
            },
          });
        }
        await tx.search.update({
          where: { id: search.id },
          data: {
            status: "COMPLETE",
            chargedCredits: count,
            chargedAt: new Date(),
            reservationReleasedAt: new Date(),
            completedAt: new Date(),
          },
        });
        await tx.notification.create({
          data: {
            workspaceId: search.workspaceId,
            userId: search.createdById,
            type: "SEARCH_COMPLETE",
            title: "Search complete",
            message: `${count} prospects are ready to review.`,
            actionUrl: `/search/${search.id}`,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    await writeAudit({
      workspaceId: search.workspaceId,
      actorId: search.createdById,
      action: "search.complete",
      entityType: "search",
      entityId: search.id,
      metadata: { resultCount: count, provider: source.provenance.provider },
    });
    return { resultCount: count };
  } catch (error) {
    if (error instanceof JobLeaseLostError) throw error;
    const message =
      error instanceof Error
        ? error.message.slice(0, 300)
        : "Search processing failed";
    const afterFailure = await db.search.findUniqueOrThrow({
      where: { id: search.id },
    });
    if (afterFailure.chargedAt || afterFailure.status === "COMPLETE") {
      return {
        resultCount: await db.searchResult.count({
          where: { searchId: search.id },
        }),
      };
    }
    const attempt = payload.attempt ?? 1;
    const maxAttempts = payload.maxAttempts ?? 1;
    if (attempt < maxAttempts) {
      await db.$transaction(async (tx) => {
        const jobClaim = await tx.searchJob.updateMany({
          where: { id: payload.jobId, status: "RUNNING", runToken },
          data: {
            status: "RETRYING",
            runToken: null,
            errorCode: "RETRY_PENDING",
            errorMessage:
              "A temporary processing error occurred; the job will retry.",
            metrics: {
              internalMessage:
                env.NODE_ENV === "development" ? message : undefined,
            },
          },
        });
        if (!jobClaim.count)
          throw new JobLeaseLostError("Search job lease lost");
        await tx.search.update({
          where: { id: search.id },
          data: { status: "QUEUED", errorCode: null, errorMessage: null },
        });
      });
      throw error;
    }
    await assertJobLeaseOwner(payload.jobId, runToken);
    const providerCleanup = await cleanupFailedProviderArtifacts(
      search.id,
      fetchedProvenance,
    );
    const cleanupCounts = await db.$transaction(
      async (tx) => {
        const failedSearch = await tx.search.findUniqueOrThrow({
          where: { id: search.id },
        });
        const jobClaim = await tx.searchJob.updateMany({
          where: { id: payload.jobId, status: "RUNNING", runToken },
          data: {
            status: "FAILED",
            runToken: null,
            errorCode: "PROCESSING_FAILED",
            errorMessage: "Search processing failed. Retry or contact support.",
            completedAt: new Date(),
            metrics: {
              internalMessage:
                env.NODE_ENV === "development" ? message : undefined,
            },
          },
        });
        if (!jobClaim.count)
          throw new JobLeaseLostError("Search job lease lost");
        if (!failedSearch.reservationReleasedAt && !failedSearch.chargedAt) {
          const workspace = await tx.workspace.update({
            where: { id: search.workspaceId },
            data: {
              creditReserved: { decrement: failedSearch.reservedCredits },
            },
          });
          await tx.creditLedger.create({
            data: {
              workspaceId: search.workspaceId,
              userId: search.createdById,
              type: "RESERVATION_RELEASE",
              amount: 0,
              balanceAfter: workspace.creditBalance,
              referenceType: "search",
              referenceId: search.id,
              idempotencyKey: `search:${search.id}:failure-release`,
              description: `${failedSearch.reservedCredits} reserved credits released after processing failure`,
            },
          });
        }
        const subjects = await tx.searchResult.findMany({
          where: { searchId: search.id },
          select: { companyId: true, contactId: true, consumerId: true },
        });
        const contactIds = subjects.flatMap((item) =>
          item.contactId ? [item.contactId] : [],
        );
        const consumerIds = subjects.flatMap((item) =>
          item.consumerId ? [item.consumerId] : [],
        );
        const companyIds = subjects.flatMap((item) =>
          item.companyId ? [item.companyId] : [],
        );
        const removedResults = await tx.searchResult.deleteMany({
          where: { searchId: search.id },
        });
        const removedContacts = await tx.contact.deleteMany({
          where: {
            id: { in: contactIds },
            results: { none: {} },
            listItems: { none: {} },
          },
        });
        const removedConsumers = await tx.consumerProspect.deleteMany({
          where: {
            id: { in: consumerIds },
            results: { none: {} },
            listItems: { none: {} },
          },
        });
        const removedCompanies = await tx.company.deleteMany({
          where: {
            id: { in: companyIds },
            results: { none: {} },
            contacts: { none: {} },
          },
        });
        const removedSources = await tx.dataSourceRecord.deleteMany({
          where: { id: { in: providerCleanup.removableIds } },
        });
        await tx.search.update({
          where: { id: search.id },
          data: {
            status: "FAILED",
            reservationReleasedAt:
              failedSearch.reservationReleasedAt ?? new Date(),
            errorCode: "PROCESSING_FAILED",
            errorMessage: "Search processing failed. Retry or contact support.",
          },
        });
        return {
          results: removedResults.count,
          contacts: removedContacts.count,
          consumers: removedConsumers.count,
          companies: removedCompanies.count,
          sources: removedSources.count,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    await writeAudit({
      workspaceId: search.workspaceId,
      actorId: search.createdById,
      action: "search.failure_cleanup",
      entityType: "search",
      entityId: search.id,
      metadata: {
        ...cleanupCounts,
        providerCleanupFailures: providerCleanup.providerCleanupFailures,
      },
    });
    throw error;
  } finally {
    lease.stop();
  }
}

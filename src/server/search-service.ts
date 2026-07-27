import { Prisma } from "@prisma/client";
import { db } from "@/lib/server/db";
import { approvedB2CSource, env } from "@/lib/server/env";
import { decryptSensitive, maskEmail, maskPhone } from "@/lib/server/crypto";
import { AppError } from "@/lib/server/errors";
import { compactLeadRecord, type LeadRecordValue } from "@/lib/leads/columns";
import type { RequestContext } from "@/server/auth-context";
import type { z } from "zod";
import type { createSearchSchema, resultsQuerySchema } from "@/server/schemas";
import {
  enqueueSearch,
  QueueEnqueueUncertainError,
  queueReconciliationIsAccepted,
  removeUnclaimedSearchJob,
  searchQueue,
  shouldRunSearchInline,
} from "@/server/job-queue";
import { processSearchJob } from "@/server/pipeline";
import {
  createDemoSearch,
  demoState,
  persistDemoSearchHistory,
  type PublicProspect,
} from "@/server/demo-store";
import { writeAudit } from "@/server/audit";
import {
  readProfileSnapshot,
  snapshotDisplayFields,
} from "@/server/profile-snapshot";
import type { searchUnderstandingSchema } from "@/server/intelligence/schemas";

type CreateSearchInput = z.infer<typeof createSearchSchema>;
type ResultsQuery = z.infer<typeof resultsQuerySchema>;
type SearchInterpretation = z.infer<typeof searchUnderstandingSchema>;

function sanitizeSearchForRead<
  T extends {
    retentionUntil: Date;
    name: string;
    query: string;
    purpose: string;
    filters: unknown;
    idempotencyKey: string | null;
    audienceSourceReference: string | null;
    legitimateInterestAssessment: string | null;
  },
>(search: T) {
  const {
    idempotencyKey: _idempotencyKey,
    audienceSourceReference: _audienceSourceReference,
    legitimateInterestAssessment: _legitimateInterestAssessment,
    ...safe
  } = search;
  void _idempotencyKey;
  void _audienceSourceReference;
  void _legitimateInterestAssessment;
  if (search.retentionUntil > new Date()) return safe;
  return {
    ...safe,
    name: "Expired search",
    query: "",
    purpose: "Expired prospect research",
    filters: null,
  };
}

async function releaseUnavailableQueue(input: {
  context: RequestContext;
  searchId: string;
  jobId: string;
}) {
  const queueState = await removeUnclaimedSearchJob(input.jobId);
  if (queueReconciliationIsAccepted(queueState)) return false;
  try {
    return await db.$transaction(
      async (tx) => {
        const search = await tx.search.findUniqueOrThrow({
          where: { id: input.searchId },
        });
        const job = await tx.searchJob.findUniqueOrThrow({
          where: { id: input.jobId },
        });
        if (
          search.status !== "QUEUED" ||
          job.status !== "QUEUED" ||
          search.reservationReleasedAt ||
          search.chargedAt
        ) {
          return false;
        }
        const searchClaim = await tx.search.updateMany({
          where: {
            id: input.searchId,
            status: "QUEUED",
            reservationReleasedAt: null,
            chargedAt: null,
          },
          data: {
            status: "FAILED",
            reservationReleasedAt: new Date(),
            errorCode: "QUEUE_UNAVAILABLE",
            errorMessage: "Background processing is temporarily unavailable.",
          },
        });
        if (!searchClaim.count) return false;
        const jobClaim = await tx.searchJob.updateMany({
          where: { id: input.jobId, status: "QUEUED" },
          data: {
            status: "FAILED",
            errorCode: "QUEUE_UNAVAILABLE",
            errorMessage: "Background processing is temporarily unavailable.",
            completedAt: new Date(),
          },
        });
        if (!jobClaim.count) {
          throw new Error("QUEUE_JOB_CLAIMED_DURING_RECONCILIATION");
        }
        const workspace = await tx.workspace.update({
          where: { id: input.context.workspaceId },
          data: { creditReserved: { decrement: search.reservedCredits } },
        });
        await tx.creditLedger.create({
          data: {
            workspaceId: input.context.workspaceId,
            userId: input.context.userId,
            type: "RESERVATION_RELEASE",
            amount: 0,
            balanceAfter: workspace.creditBalance,
            referenceType: "search",
            referenceId: search.id,
            idempotencyKey: `search:${search.id}:queue-release`,
            description: `${search.reservedCredits} reserved credits released because the queue is unavailable`,
          },
        });
        return true;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch {
    // A serialization conflict or claim race means processing may already be
    // underway. Preserve the reservation and report the search as accepted.
    return false;
  }
}

function safeDecrypt(value?: string | null) {
  if (!value) return undefined;
  try {
    return decryptSensitive(value);
  } catch {
    return undefined;
  }
}

export async function createSearch(
  context: RequestContext,
  input: CreateSearchInput,
  retentionDays: number,
  idempotencyKey?: string,
  interpretation?: SearchInterpretation,
) {
  if (context.demo) {
    if (demoState.creditBalance < input.targetCount) {
      throw new AppError(
        "INSUFFICIENT_CREDITS",
        `This search needs ${input.targetCount} credits; ${demoState.creditBalance} are available.`,
        402,
      );
    }
    const created = await createDemoSearch(input, retentionDays);
    return {
      ...created,
      results: created.results.map((result) => serializeDemoResult(result)),
    };
  }

  if (input.mode === "B2C" && env.apifyEnabled) {
    const actorId = env.APIFY_B2C_ACTOR_ID;
    const sourceAuthorized = actorId
      ? approvedB2CSource(env.approvedB2CSources, {
          reference: input.audienceSourceReference,
          audienceSource: input.audienceSource,
          actorId,
          workspaceId: context.workspaceId,
          jurisdiction: input.jurisdiction,
          termsVersion: env.APIFY_TERMS_VERSION,
        })
      : undefined;
    if (!sourceAuthorized) {
      throw new AppError(
        "B2C_SOURCE_NOT_AUTHORIZED",
        "This consumer source is not authorized for the current workspace.",
        403,
      );
    }
  }

  if (idempotencyKey) {
    const existing = await db.search.findFirst({
      where: {
        workspaceId: context.workspaceId,
        createdById: context.userId,
        idempotencyKey,
      },
      include: { jobs: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (existing) {
      return {
        search: existing,
        job: existing.jobs[0],
        results: [],
        replayed: true,
      };
    }
  }

  const created = await db.$transaction(
    async (tx) => {
      const workspace = await tx.workspace.findUniqueOrThrow({
        where: { id: context.workspaceId },
        select: { creditBalance: true, creditReserved: true },
      });
      const available = workspace.creditBalance - workspace.creditReserved;
      if (available < input.targetCount) {
        throw new AppError(
          "INSUFFICIENT_CREDITS",
          `This search needs ${input.targetCount} credits; ${available} are available.`,
          402,
        );
      }
      const retentionUntil = new Date(Date.now() + retentionDays * 86_400_000);
      const search = await tx.search.create({
        data: {
          workspaceId: context.workspaceId,
          createdById: context.userId,
          name: input.name ?? input.query.slice(0, 120),
          query: input.query,
          mode: input.mode,
          purpose:
            input.purpose ??
            "Relevant B2B prospect research and manual outreach preparation",
          lawfulBasis: input.lawfulBasis,
          audienceSource: input.audienceSource,
          audienceSourceReference: input.audienceSourceReference,
          jurisdiction: input.jurisdiction,
          legitimateInterestAssessment: input.legitimateInterestAssessment,
          filters: input.filters,
          interpretedQuery: interpretation,
          researchPlan: interpretation?.researchPlan,
          targetCount: input.targetCount,
          reservedCredits: input.targetCount,
          idempotencyKey,
          status: "QUEUED",
          retentionUntil,
        },
      });
      const job = await tx.searchJob.create({
        data: {
          searchId: search.id,
          status: "QUEUED",
          stage: "CREATED",
          provider: env.apifyEnabled ? "apify" : "demo",
        },
      });
      await tx.workspace.update({
        where: { id: context.workspaceId },
        data: { creditReserved: { increment: input.targetCount } },
      });
      await tx.creditLedger.create({
        data: {
          workspaceId: context.workspaceId,
          userId: context.userId,
          type: "SEARCH_RESERVATION",
          amount: 0,
          balanceAfter: workspace.creditBalance,
          referenceType: "search",
          referenceId: search.id,
          idempotencyKey: `search:${search.id}:reservation`,
          description: `${input.targetCount} credits reserved pending delivery`,
          metadata: { reserved: input.targetCount },
        },
      });
      const audit = await tx.auditLog.create({
        data: {
          workspaceId: context.workspaceId,
          actorId: context.userId,
          action: "search.create",
          entityType: "search",
          entityId: search.id,
          metadata: {
            mode: input.mode,
            targetCount: input.targetCount,
            retentionDays,
            retentionJustification: input.retentionJustification,
            audienceSource: input.audienceSource,
            audienceSourceReference: input.audienceSourceReference,
            jurisdiction: input.jurisdiction,
            ...(input.mode === "B2C"
              ? { attestations: input.attestations }
              : {}),
          },
        },
      });
      return { search, job, audit };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  let queued = false;
  try {
    queued = await enqueueSearch({
      searchId: created.search.id,
      jobId: created.job.id,
    });
  } catch (error) {
    // A timed-out Redis command cannot be cancelled and may still complete.
    // Keep the reservation pending instead of racing a worker with cleanup.
    queued = error instanceof QueueEnqueueUncertainError;
  }
  if (!queued && env.NODE_ENV === "production") {
    const released = await releaseUnavailableQueue({
      context,
      searchId: created.search.id,
      jobId: created.job.id,
    });
    if (released) {
      throw new AppError(
        "QUEUE_UNAVAILABLE",
        "Background processing is temporarily unavailable. No credits were charged.",
        503,
      );
    }
  }
  if (shouldRunSearchInline(queued, env.NODE_ENV))
    await processSearchJob({
      searchId: created.search.id,
      jobId: created.job.id,
    });

  const refreshed = await db.search.findUniqueOrThrow({
    where: { id: created.search.id },
  });
  const refreshedJob = await db.searchJob.findUniqueOrThrow({
    where: { id: created.job.id },
  });
  return { search: refreshed, job: refreshedJob, results: [] };
}

export async function getSearch(context: RequestContext, id: string) {
  if (context.demo) {
    const search = demoState.searches.find((item) => item.id === id);
    if (!search) throw new AppError("NOT_FOUND", "Search not found.", 404);
    const job = demoState.jobs.find((item) => item.searchId === id);
    const expired = new Date(search.retentionUntil) <= new Date();
    return {
      search: expired
        ? {
            ...search,
            name: "Expired search",
            query: "",
            purpose: "Expired prospect research",
            filters: {},
          }
        : search,
      job,
      resultCount: expired
        ? 0
        : Math.max(
            search.resultCount,
            demoState.results.filter((item) => item.searchId === id).length,
          ),
    };
  }
  const now = new Date();
  const search = await db.search.findFirst({
    where: { id, workspaceId: context.workspaceId },
    include: {
      jobs: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: {
        select: { results: { where: { retentionUntil: { gt: now } } } },
      },
    },
  });
  if (!search) throw new AppError("NOT_FOUND", "Search not found.", 404);
  return {
    search: sanitizeSearchForRead(search),
    job: search.jobs[0],
    resultCount: search._count.results,
  };
}

export async function listSearches(
  context: RequestContext,
  page = 1,
  pageSize = 25,
) {
  if (context.demo) {
    const now = new Date();
    const availableResultCounts = new Map<string, number>();
    for (const result of demoState.results) {
      availableResultCounts.set(
        result.searchId,
        (availableResultCounts.get(result.searchId) ?? 0) + 1,
      );
    }
    const data = demoState.searches
      .slice((page - 1) * pageSize, page * pageSize)
      .map((search) => ({
        ...(new Date(search.retentionUntil) <= now
          ? {
              ...search,
              name: "Expired search",
              query: "",
              purpose: "Expired prospect research",
              filters: {},
              resultCount: 0,
            }
          : search),
        exportableResultCount: availableResultCounts.get(search.id) ?? 0,
      }));
    return { data, total: demoState.searches.length };
  }
  const where = { workspaceId: context.workspaceId };
  const now = new Date();
  const [data, total] = await db.$transaction([
    db.search.findMany({
      where,
      include: {
        _count: {
          select: { results: { where: { retentionUntil: { gt: now } } } },
        },
        jobs: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.search.count({ where }),
  ]);
  return { data: data.map(sanitizeSearchForRead), total };
}

function filterDemoResults(data: PublicProspect[], query: ResultsQuery) {
  const now = Date.now();
  const filtered = data.filter(
    (item) =>
      new Date(
        demoState.searches.find((search) => search.id === item.searchId)
          ?.retentionUntil ?? 0,
      ).getTime() > now &&
      (!query.searchId || item.searchId === query.searchId) &&
      item.score >= query.minScore &&
      (!query.industry ||
        item.industry?.toLowerCase().includes(query.industry.toLowerCase())) &&
      (!query.location ||
        item.location?.toLowerCase().includes(query.location.toLowerCase())) &&
      (!query.title ||
        item.title?.toLowerCase().includes(query.title.toLowerCase())) &&
      (!query.companySize || item.companySize === query.companySize),
  );
  return filtered.sort((a, b) => {
    if (query.sort === "newest") return b.createdAt.localeCompare(a.createdAt);
    if (query.sort === "company")
      return (a.company ?? "").localeCompare(b.company ?? "");
    if (query.sort === "location")
      return (a.location ?? "").localeCompare(b.location ?? "");
    return b.score - a.score;
  });
}

function serializeDemoResult(result: PublicProspect, revealSensitive = false) {
  const { normalized: _normalized, ...item } = result;
  void _normalized;
  const redactEmail = (value: LeadRecordValue | undefined) =>
    !revealSensitive && typeof value === "string" ? maskEmail(value) : value;
  const redactPhone = (value: LeadRecordValue | undefined) =>
    !revealSensitive && typeof value === "string" ? maskPhone(value) : value;
  const leadFields = item.leadFields
    ? compactLeadRecord({
        ...item.leadFields,
        email: redactEmail(item.leadFields.email),
        personal_email: redactEmail(item.leadFields.personal_email),
        mobile_number: redactPhone(item.leadFields.mobile_number),
      })
    : undefined;
  return {
    ...item,
    leadFields,
    subjectType: item.mode === "B2C" ? "consumer" : "professional_contact",
    email: !revealSensitive && item.email ? maskEmail(item.email) : item.email,
    phone: !revealSensitive && item.phone ? maskPhone(item.phone) : item.phone,
  };
}

export async function listResults(
  context: RequestContext,
  query: ResultsQuery,
  revealSensitive = false,
) {
  if (revealSensitive && context.role === "VIEWER") {
    throw new AppError(
      "FORBIDDEN",
      "Member access is required to reveal contact details.",
      403,
    );
  }
  if (revealSensitive && !query.searchId) {
    throw new AppError(
      "VALIDATION_ERROR",
      "A search ID is required to reveal contact details.",
      422,
    );
  }
  if (context.demo) {
    const all = filterDemoResults(demoState.results, query);
    const page = all.slice(
      (query.page - 1) * query.pageSize,
      query.page * query.pageSize,
    );
    const revealed = page.filter(
      (item) => revealSensitive && item.mode === "B2B" && !item.isSuppressed,
    );
    const data = page.map((item) =>
      serializeDemoResult(
        item,
        revealSensitive && item.mode === "B2B" && !item.isSuppressed,
      ),
    );
    if (revealed.length) {
      await writeAudit({
        workspaceId: context.workspaceId,
        actorId: context.userId,
        action: "prospect.contact.bulk_reveal",
        entityType: "search",
        entityId: query.searchId,
        metadata: {
          mode: "B2B",
          page: query.page,
          count: revealed.length,
          resultIds: revealed.map((item) => item.id),
        },
      });
    }
    return {
      data,
      total: all.length,
      stats: {
        totalProspects: all.length,
        highQualityProspects: all.filter((item) => item.score >= 80).length,
        averageScore: all.length
          ? Math.round(
              all.reduce((sum, item) => sum + item.score, 0) / all.length,
            )
          : 0,
      },
    };
  }

  const where: Prisma.SearchResultWhereInput = {
    retentionUntil: { gt: new Date() },
    search: {
      workspaceId: context.workspaceId,
      ...(query.searchId ? { id: query.searchId } : {}),
    },
    score: { gte: query.minScore },
    ...(query.industry
      ? {
          company: {
            industry: { contains: query.industry, mode: "insensitive" },
          },
        }
      : {}),
    ...(query.location
      ? {
          OR: [
            {
              company: {
                location: { contains: query.location, mode: "insensitive" },
              },
            },
            {
              contact: {
                location: { contains: query.location, mode: "insensitive" },
              },
            },
            {
              consumer: {
                location: { contains: query.location, mode: "insensitive" },
              },
            },
          ],
        }
      : {}),
    ...(query.title
      ? { contact: { title: { contains: query.title, mode: "insensitive" } } }
      : {}),
    ...(query.companySize
      ? { company: { employeeRange: query.companySize } }
      : {}),
  };
  const orderBy: Prisma.SearchResultOrderByWithRelationInput =
    query.sort === "newest"
      ? { createdAt: "desc" }
      : query.sort === "company"
        ? { company: { name: "asc" } }
        : query.sort === "location"
          ? { company: { location: "asc" } }
          : { score: "desc" };
  const include = {
    search: true,
    company: true,
    contact: true,
    consumer: true,
    aiResponses: true,
  } satisfies Prisma.SearchResultInclude;
  const [rows, total, aggregates] = await db.$transaction([
    db.searchResult.findMany({
      where,
      include,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    db.searchResult.count({ where }),
    db.searchResult.aggregate({ where, _avg: { score: true } }),
  ]);
  const highQualityProspects = await db.searchResult.count({
    where: { ...where, score: { gte: Math.max(80, query.minScore) } },
  });
  const revealed = rows.filter(
    (row) => revealSensitive && !row.consumer && !row.isSuppressed,
  );
  if (revealed.length) {
    await writeAudit({
      workspaceId: context.workspaceId,
      actorId: context.userId,
      action: "prospect.contact.bulk_reveal",
      entityType: "search",
      entityId: query.searchId,
      metadata: {
        mode: "B2B",
        page: query.page,
        count: revealed.length,
        resultIds: revealed.map((row) => row.id),
      },
    });
  }
  return {
    data: rows.map((row) =>
      serializeDatabaseResult(
        row,
        revealSensitive && !row.consumer && !row.isSuppressed,
      ),
    ),
    total,
    stats: {
      totalProspects: total,
      highQualityProspects,
      averageScore: Math.round(aggregates._avg.score ?? 0),
    },
  };
}

type ResultWithRelations = Prisma.SearchResultGetPayload<{
  include: {
    search: true;
    company: true;
    contact: true;
    consumer: true;
    aiResponses: true;
  };
}>;

export function serializeDatabaseResult(
  row: ResultWithRelations,
  revealSensitive = false,
) {
  const snapshot = readProfileSnapshot(row.profileSnapshot);
  const snapshotFields = snapshot ? snapshotDisplayFields(snapshot) : null;
  const mode = snapshotFields?.mode ?? (row.consumer ? "B2C" : "B2B");
  const contact = row.contact;
  const consumer = row.consumer;
  const email = revealSensitive
    ? safeDecrypt(contact?.encryptedEmail ?? consumer?.encryptedEmail)
    : (contact?.emailMasked ?? consumer?.emailMasked);
  const phone = revealSensitive
    ? safeDecrypt(contact?.encryptedPhone ?? consumer?.encryptedPhone)
    : (contact?.phoneMasked ?? consumer?.phoneMasked);
  const snapshotLeadFields =
    snapshot?.mode === "B2B" ? snapshot.leadFields : {};
  const leadFields =
    mode === "B2B"
      ? compactLeadRecord({
          ...snapshotLeadFields,
          first_name:
            snapshotLeadFields.first_name ??
            (snapshot?.mode === "B2B"
              ? snapshot.contact.firstName
              : contact?.firstName),
          last_name:
            snapshotLeadFields.last_name ??
            (snapshot?.mode === "B2B"
              ? snapshot.contact.lastName
              : contact?.lastName),
          full_name:
            snapshotLeadFields.full_name ??
            (snapshot?.mode === "B2B"
              ? snapshot.contact.fullName
              : contact?.fullName),
          job_title:
            snapshotLeadFields.job_title ??
            (snapshot?.mode === "B2B"
              ? snapshot.contact.title
              : contact?.title),
          seniority_level:
            snapshotLeadFields.seniority_level ??
            (snapshot?.mode === "B2B"
              ? snapshot.contact.seniority
              : contact?.seniority),
          functional_level:
            snapshotLeadFields.functional_level ?? contact?.department,
          linkedin:
            snapshotLeadFields.linkedin ??
            (snapshot?.mode === "B2B"
              ? snapshot.contact.linkedinUrl
              : contact?.linkedinUrl),
          city:
            snapshotLeadFields.city ??
            (snapshot?.mode === "B2B"
              ? snapshot.contact.location
              : contact?.location),
          country:
            snapshotLeadFields.country ??
            (snapshot?.mode === "B2B"
              ? snapshot.contact.country
              : contact?.country),
          email,
          mobile_number: phone,
          company_name:
            snapshotLeadFields.company_name ??
            (snapshot?.mode === "B2B"
              ? snapshot.company.name
              : row.company?.name),
          company_domain:
            snapshotLeadFields.company_domain ??
            (snapshot?.mode === "B2B"
              ? snapshot.company.domain
              : row.company?.domain),
          company_website:
            snapshotLeadFields.company_website ??
            (snapshot?.mode === "B2B"
              ? snapshot.company.website
              : row.company?.website),
          company_linkedin:
            snapshotLeadFields.company_linkedin ??
            (snapshot?.mode === "B2B"
              ? snapshot.company.linkedinUrl
              : row.company?.linkedinUrl),
          company_description:
            snapshotLeadFields.company_description ??
            (snapshot?.mode === "B2B"
              ? snapshot.company.description
              : row.company?.description),
          industry:
            snapshotLeadFields.industry ??
            (snapshot?.mode === "B2B"
              ? snapshot.company.industry
              : row.company?.industry),
          company_size:
            snapshotLeadFields.company_size ??
            (snapshot?.mode === "B2B"
              ? (snapshot.company.employeeCount ??
                snapshot.company.employeeRange)
              : (row.company?.employeeCount ?? row.company?.employeeRange)),
          company_founded_year:
            snapshotLeadFields.company_founded_year ??
            (snapshot?.mode === "B2B"
              ? snapshot.company.foundedYear
              : row.company?.foundedYear),
          company_city:
            snapshotLeadFields.company_city ??
            (snapshot?.mode === "B2B"
              ? snapshot.company.city
              : row.company?.city),
          company_country:
            snapshotLeadFields.company_country ??
            (snapshot?.mode === "B2B"
              ? snapshot.company.country
              : row.company?.country),
          company_full_address:
            snapshotLeadFields.company_full_address ??
            (snapshot?.mode === "B2B"
              ? snapshot.company.location
              : row.company?.location),
          company_annual_revenue:
            snapshotLeadFields.company_annual_revenue ??
            (snapshot?.mode === "B2B"
              ? snapshot.company.revenueRange
              : row.company?.revenueRange),
          company_total_funding_clean:
            snapshotLeadFields.company_total_funding_clean ??
            (row.company?.totalFundingUsd === null ||
            row.company?.totalFundingUsd === undefined
              ? undefined
              : String(row.company.totalFundingUsd)),
          keywords:
            snapshotLeadFields.keywords ??
            (snapshot?.mode === "B2B"
              ? snapshot.company.keywords.join(", ")
              : row.company?.keywords.join(", ")),
          company_technologies:
            snapshotLeadFields.company_technologies ??
            (snapshot?.mode === "B2B"
              ? snapshot.company.technologies.join(", ")
              : row.company?.technologies.join(", ")),
        })
      : undefined;
  return {
    id: row.id,
    companyId: row.companyId,
    searchId: row.searchId,
    mode,
    subjectType: mode === "B2C" ? "consumer" : "professional_contact",
    name:
      snapshotFields?.name ??
      contact?.fullName ??
      consumer?.displayName ??
      "Unknown",
    title: snapshotFields ? snapshotFields.title : contact?.title,
    company: snapshotFields ? snapshotFields.company : row.company?.name,
    industry: snapshotFields
      ? snapshotFields.industry
      : (row.company?.industry ??
        (mode === "B2C" ? "Consumer audience" : undefined)),
    companySize: snapshotFields
      ? snapshotFields.companySize
      : row.company?.employeeRange,
    location: snapshotFields
      ? snapshotFields.location
      : (row.company?.location ?? contact?.location ?? consumer?.location),
    email,
    phone,
    emailVerified:
      (contact?.emailVerification ?? consumer?.emailVerification) ===
      "VERIFIED",
    linkedin: snapshotFields ? snapshotFields.linkedin : contact?.linkedinUrl,
    website: snapshotFields ? snapshotFields.website : row.company?.website,
    leadFields,
    score: row.score,
    rank: row.rank,
    status: row.isSuppressed
      ? "suppressed"
      : (contact?.emailVerification ?? consumer?.emailVerification) ===
          "VERIFIED"
        ? "verified"
        : "likely",
    buyingIntent: row.buyingIntent,
    summary: row.summary,
    reasons: row.reasons,
    suggestedOffer: row.suggestedOffer,
    decisionMakerConfidence: row.confidence ?? 0,
    recommendedChannel: row.recommendedChannel,
    scoreBreakdown: row.scoreBreakdown,
    isSuppressed: row.isSuppressed,
    sourceProvider: snapshot?.sourceProvider,
    sourceUrl: snapshot?.sourceUrl,
    sourceObservedAt: snapshot?.observedAt,
    // Canonical status is not sufficient to claim current permission: purpose,
    // expiry, withdrawal, and channel are evaluated only on the detail path.
    consentStatus: consumer ? "REVIEW_REQUIRED" : undefined,
    retentionUntil: row.retentionUntil,
    createdAt: row.createdAt,
  };
}

export async function getResult(
  context: RequestContext,
  id: string,
  revealSensitive = false,
) {
  if (context.demo) {
    const result = demoState.results.find((item) => item.id === id);
    if (!result) throw new AppError("NOT_FOUND", "Prospect not found.", 404);
    const search = demoState.searches.find(
      (item) => item.id === result.searchId,
    );
    if (!search || new Date(search.retentionUntil) <= new Date()) {
      throw new AppError(
        "RETENTION_EXPIRED",
        "This prospect has reached its retention limit.",
        410,
      );
    }
    if (revealSensitive && result.isSuppressed) {
      throw new AppError(
        "SUPPRESSED",
        "Suppressed contact details cannot be revealed.",
        409,
      );
    }
    return serializeDemoResult(result, revealSensitive);
  }
  const evidenceCutoff = new Date();
  const row = await db.searchResult.findFirst({
    where: { id, search: { workspaceId: context.workspaceId } },
    include: {
      search: true,
      company: {
        include: {
          evidence: {
            where: {
              expiresAt: { gt: evidenceCutoff },
              search: { results: { some: { id } } },
            },
            orderBy: { observedAt: "desc" },
            take: 20,
          },
        },
      },
      contact: {
        include: {
          evidence: {
            where: {
              expiresAt: { gt: evidenceCutoff },
              search: { results: { some: { id } } },
            },
            orderBy: { observedAt: "desc" },
            take: 20,
          },
          consentRecords: {
            orderBy: { capturedAt: "desc" },
            take: 5,
            select: {
              status: true,
              channel: true,
              purpose: true,
              source: true,
              capturedAt: true,
              expiresAt: true,
              withdrawnAt: true,
            },
          },
        },
      },
      consumer: {
        include: {
          evidence: {
            where: {
              expiresAt: { gt: evidenceCutoff },
              search: { results: { some: { id } } },
            },
            orderBy: { observedAt: "desc" },
            take: 20,
          },
          consentRecords: {
            orderBy: { capturedAt: "desc" },
            take: 5,
            select: {
              status: true,
              channel: true,
              purpose: true,
              source: true,
              capturedAt: true,
              expiresAt: true,
              withdrawnAt: true,
            },
          },
        },
      },
      aiResponses: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
  if (!row) throw new AppError("NOT_FOUND", "Prospect not found.", 404);
  if (row.retentionUntil <= new Date()) {
    throw new AppError(
      "RETENTION_EXPIRED",
      "This prospect has reached its retention limit.",
      410,
    );
  }
  if (revealSensitive) {
    if (context.role === "VIEWER") {
      throw new AppError(
        "FORBIDDEN",
        "Member access is required to reveal contact details.",
        403,
      );
    }
    if (row.consumer && context.role !== "OWNER" && context.role !== "ADMIN") {
      throw new AppError(
        "FORBIDDEN",
        "Administrator access is required to reveal consumer contact details.",
        403,
      );
    }
    if (row.isSuppressed) {
      throw new AppError(
        "SUPPRESSED",
        "Suppressed contact details cannot be revealed.",
        409,
      );
    }
    const retentionUntil = row.retentionUntil;
    if (!retentionUntil || retentionUntil <= new Date()) {
      throw new AppError(
        "RETENTION_EXPIRED",
        "Contact details have reached their retention limit.",
        410,
      );
    }
    let revealedChannels: string[] | undefined;
    if (row.consumer) {
      const now = new Date();
      revealedChannels = row.consumer.consentRecords
        .filter(
          (record) =>
            record.status === "GRANTED" &&
            record.purpose === row.search.purpose &&
            record.channel &&
            record.capturedAt <= now &&
            !record.withdrawnAt &&
            (!record.expiresAt || record.expiresAt > now),
        )
        .map((record) => record.channel!);
      if (!revealedChannels.length) {
        throw new AppError(
          "CHANNEL_PERMISSION_REQUIRED",
          "No current, purpose-specific channel permission allows contact detail reveal.",
          403,
        );
      }
    }
    await writeAudit({
      workspaceId: context.workspaceId,
      actorId: context.userId,
      action: "prospect.contact.reveal",
      entityType: row.consumer ? "consumer" : "professional_contact",
      entityId: row.consumer?.id ?? row.contact?.id,
      metadata: {
        resultId: row.id,
        mode: row.consumer ? "B2C" : "B2B",
        revealedChannels,
      },
    });
  }
  const serialized = serializeDatabaseResult(row, revealSensitive);
  if (revealSensitive && row.consumer) {
    const now = new Date();
    const allowed = new Set(
      row.consumer.consentRecords
        .filter(
          (record) =>
            record.status === "GRANTED" &&
            record.purpose === row.search.purpose &&
            record.channel &&
            record.capturedAt <= now &&
            !record.withdrawnAt &&
            (!record.expiresAt || record.expiresAt > now),
        )
        .map((record) => record.channel),
    );
    if (!allowed.has("EMAIL"))
      serialized.email = row.consumer.emailMasked ?? undefined;
    if (!allowed.has("PHONE"))
      serialized.phone = row.consumer.phoneMasked ?? undefined;
  }
  const now = new Date();
  const currentConsumerPermissions =
    row.consumer?.consentRecords.filter(
      (record) =>
        record.status === "GRANTED" &&
        record.purpose === row.search.purpose &&
        record.channel &&
        record.capturedAt <= now &&
        !record.withdrawnAt &&
        (!record.expiresAt || record.expiresAt > now),
    ) ?? [];
  const currentPermissionStatus = row.consumer
    ? currentConsumerPermissions.length
      ? "GRANTED"
      : row.consumer.consentRecords.some(
            (record) =>
              record.purpose === row.search.purpose &&
              record.status === "WITHDRAWN",
          )
        ? "WITHDRAWN"
        : "REVIEW_REQUIRED"
    : undefined;
  return {
    ...serialized,
    consentStatus: currentPermissionStatus,
    currentPermissionChannels: currentConsumerPermissions.flatMap((record) =>
      record.channel ? [record.channel] : [],
    ),
    evidence: [
      ...(row.company?.evidence ?? []),
      ...(row.contact?.evidence ?? []),
      ...(row.consumer?.evidence ?? []),
    ],
    consent: row.contact?.consentRecords ?? row.consumer?.consentRecords ?? [],
    searchPurpose: row.search.purpose,
    retentionUntil: row.retentionUntil,
  };
}

export async function deleteSearch(context: RequestContext, id: string) {
  if (context.demo) {
    const index = demoState.searches.findIndex((item) => item.id === id);
    if (index < 0) throw new AppError("NOT_FOUND", "Search not found.", 404);
    demoState.searches.splice(index, 1);
    demoState.jobs = demoState.jobs.filter((item) => item.searchId !== id);
    demoState.results = demoState.results.filter(
      (item) => item.searchId !== id,
    );
    persistDemoSearchHistory();
    return;
  }
  const found = await db.search.findFirst({
    where: { id, workspaceId: context.workspaceId },
    include: { jobs: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!found) throw new AppError("NOT_FOUND", "Search not found.", 404);
  const job = found.jobs[0];
  if (job?.status === "RUNNING") {
    throw new AppError(
      "SEARCH_RUNNING",
      "A running search cannot be deleted until processing finishes.",
      409,
    );
  }
  if (job && ["QUEUED", "RETRYING"].includes(job.status)) {
    try {
      await (await searchQueue()?.getJob(job.id))?.remove();
    } catch {
      throw new AppError(
        "QUEUE_UNAVAILABLE",
        "The queued search could not be cancelled safely. Try again shortly.",
        503,
      );
    }
  }
  await db.$transaction(
    async (tx) => {
      const fresh = await tx.search.findUniqueOrThrow({ where: { id } });
      if (!fresh.reservationReleasedAt && !fresh.chargedAt) {
        const workspace = await tx.workspace.update({
          where: { id: context.workspaceId },
          data: { creditReserved: { decrement: fresh.reservedCredits } },
        });
        await tx.creditLedger.create({
          data: {
            workspaceId: context.workspaceId,
            userId: context.userId,
            type: "RESERVATION_RELEASE",
            amount: 0,
            balanceAfter: workspace.creditBalance,
            referenceType: "search",
            referenceId: id,
            idempotencyKey: `search:${id}:delete-release`,
            description: `${fresh.reservedCredits} reserved credits released when the search was deleted`,
          },
        });
      }
      await tx.search.delete({ where: { id } });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  await writeAudit({
    workspaceId: context.workspaceId,
    actorId: context.userId,
    action: "search.delete",
    entityType: "search",
    entityId: id,
  });
}

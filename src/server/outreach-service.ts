import { db } from "@/lib/server/db";
import { AppError } from "@/lib/server/errors";
import type { RequestContext } from "@/server/auth-context";
import { assertManualOutreach } from "@/server/compliance";
import { demoState, findDemoResult } from "@/server/demo-store";
import { generateOutreachDraft } from "@/server/ai";
import type { NormalizedProspect } from "@/server/normalize";
import type { z } from "zod";
import type { outreachSchema } from "@/server/schemas";
import { writeAudit } from "@/server/audit";
import {
  normalizedProspectFromSnapshot,
  readProfileSnapshot,
} from "@/server/profile-snapshot";

type OutreachInput = z.infer<typeof outreachSchema>;

function outreachChannel(type: OutreachInput["type"]) {
  if (type === "COLD_EMAIL" || type === "FOLLOW_UP") return "EMAIL" as const;
  if (type === "WHATSAPP") return "WHATSAPP" as const;
  return "LINKEDIN" as const;
}

export function canAccessConsumerOutreach(role: RequestContext["role"]) {
  return role === "OWNER" || role === "ADMIN";
}

export function assertConsumerOutreachRole(
  role: RequestContext["role"],
  isConsumerResult: boolean,
) {
  if (isConsumerResult && !canAccessConsumerOutreach(role)) {
    throw new AppError(
      "FORBIDDEN",
      "Administrator access is required for consumer outreach.",
      403,
    );
  }
}

export function appendWorkspaceSignature(
  body: string,
  signature?: string | null,
) {
  const normalized = signature?.trim();
  if (!normalized || body.trimEnd().endsWith(normalized)) return body;
  return `${body.trimEnd()}\n\n${normalized}`;
}

export async function createOutreachDraft(
  context: RequestContext,
  input: OutreachInput,
) {
  if (context.demo) {
    const result = findDemoResult(input.resultId);
    if (!result) throw new AppError("NOT_FOUND", "Prospect not found.", 404);
    assertManualOutreach({
      manualIntent: input.manualIntent,
      isSuppressed: result.isSuppressed,
    });
    const demoSearch = demoState.searches.find(
      (search) => search.id === result.searchId,
    );
    if (!demoSearch || new Date(demoSearch.retentionUntil) <= new Date()) {
      throw new AppError(
        "RETENTION_EXPIRED",
        "This prospect has reached its retention limit and cannot be used for outreach.",
        410,
      );
    }
    if (result.mode === "B2C" && result.consentStatus !== "GRANTED") {
      throw new AppError(
        "CONSENT_REQUIRED",
        "A current, purpose-appropriate permission record is required before drafting consumer outreach.",
        422,
      );
    }
    if (
      result.mode === "B2C" &&
      result.normalized.mode === "B2C" &&
      !result.normalized.consumer.consentChannels.includes(
        outreachChannel(input.type),
      )
    ) {
      throw new AppError(
        "CHANNEL_PERMISSION_REQUIRED",
        "This consumer record has no current, purpose-specific permission proof for the selected channel.",
        422,
      );
    }
    const draft = await generateOutreachDraft({
      item: result.normalized,
      type: input.type,
      tone: input.tone,
      offer: input.offer,
      context: input.context,
      analysis: {
        summary: result.summary,
        reasons: result.reasons,
        suggestedOffer: result.suggestedOffer,
      },
      workspaceId: context.workspaceId,
      userId: context.userId,
    });
    const saved = {
      id: `outreach-${crypto.randomUUID()}`,
      resultId: result.id,
      type: input.type,
      tone: input.tone,
      subject: draft.subject,
      body: draft.body,
      status: "DRAFT" as const,
      model: draft.model,
      createdAt: new Date().toISOString(),
    };
    demoState.outreach.unshift(saved);
    return saved;
  }

  const result = await db.searchResult.findFirst({
    where: { id: input.resultId, search: { workspaceId: context.workspaceId } },
    include: {
      search: true,
      company: true,
      contact: true,
      consumer: {
        include: { consentRecords: { orderBy: { capturedAt: "desc" } } },
      },
      aiResponses: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!result) throw new AppError("NOT_FOUND", "Prospect not found.", 404);
  assertConsumerOutreachRole(
    context.role,
    result.search.mode === "B2C" || Boolean(result.consumer),
  );
  assertManualOutreach({
    manualIntent: input.manualIntent,
    isSuppressed: result.isSuppressed,
  });
  const subjectRetention = result.retentionUntil;
  if (!subjectRetention || subjectRetention <= new Date()) {
    throw new AppError(
      "RETENTION_EXPIRED",
      "This prospect has reached its retention limit and cannot be used for outreach.",
      410,
    );
  }
  if (result.consumer && result.consumer.consentStatus !== "GRANTED") {
    throw new AppError(
      "CONSENT_REQUIRED",
      "A current, purpose-appropriate permission record is required before drafting consumer outreach.",
      422,
    );
  }
  if (result.consumer) {
    const channel = outreachChannel(input.type);
    const now = new Date();
    const channelPermission = result.consumer.consentRecords.some(
      (record) =>
        record.status === "GRANTED" &&
        record.channel === channel &&
        record.purpose === result.search.purpose &&
        record.capturedAt <= now &&
        (!record.expiresAt || record.expiresAt > now) &&
        !record.withdrawnAt,
    );
    if (!channelPermission) {
      throw new AppError(
        "CHANNEL_PERMISSION_REQUIRED",
        "This consumer record has no current, purpose-specific permission proof for the selected channel.",
        422,
      );
    }
  }

  const snapshot = readProfileSnapshot(result.profileSnapshot);
  if (
    !snapshot ||
    (snapshot.mode === "B2C" && !result.consumer) ||
    (snapshot.mode === "B2B" && !result.contact)
  ) {
    throw new AppError(
      "INCOMPLETE_RECORD",
      "This prospect does not have a complete retained result snapshot for outreach.",
      422,
    );
  }
  const permissionNow = new Date();
  const currentConsentChannels =
    result.consumer?.consentRecords
      .filter(
        (record) =>
          record.status === "GRANTED" &&
          record.channel &&
          record.purpose === result.search.purpose &&
          record.capturedAt <= permissionNow &&
          (!record.expiresAt || record.expiresAt > permissionNow) &&
          !record.withdrawnAt,
      )
      .map((record) => record.channel!) ?? [];
  const normalized: NormalizedProspect = normalizedProspectFromSnapshot(
    snapshot,
    {
      rawHash: result.id,
      consentStatus: currentConsentChannels.length ? "GRANTED" : "UNKNOWN",
      consentCapturedAt: result.consumer?.consentCapturedAt?.toISOString(),
      consentChannels: currentConsentChannels,
    },
  );
  const latestAnalysis = result.aiResponses[0]?.output as
    Record<string, unknown> | undefined;
  const analysis = {
    summary:
      result.summary ??
      String(
        latestAnalysis?.summary ?? "Relevant prospect context is available.",
      ),
    reasons: result.reasons.length
      ? result.reasons
      : ["Campaign criteria align with available evidence"],
    suggestedOffer:
      result.suggestedOffer ?? "A relevant, evidence-based introduction.",
  };
  const [draft, workspace] = await Promise.all([
    generateOutreachDraft({
      item: normalized,
      type: input.type,
      tone: input.tone,
      offer: input.offer,
      context: input.context,
      analysis,
      workspaceId: context.workspaceId,
      userId: context.userId,
    }),
    db.workspace.findUnique({
      where: { id: context.workspaceId },
      select: { emailSignature: true },
    }),
  ]);
  const body = appendWorkspaceSignature(
    draft.body,
    input.type === "COLD_EMAIL" || input.type === "FOLLOW_UP"
      ? workspace?.emailSignature
      : null,
  );
  const saved = await db.outreach.create({
    data: {
      searchResultId: result.id,
      createdById: context.userId,
      type: input.type,
      tone: input.tone,
      subject: draft.subject,
      body,
      status: "DRAFT",
      model: draft.model,
      promptVersion: draft.promptVersion,
      complianceNote:
        "Draft only. Manually verify evidence, permission, relevance, and channel rules before use.",
    },
  });
  await writeAudit({
    workspaceId: context.workspaceId,
    actorId: context.userId,
    action: "outreach.draft.create",
    entityType: "outreach",
    entityId: saved.id,
    metadata: { resultId: result.id, type: input.type, manualIntent: true },
  });
  return saved;
}

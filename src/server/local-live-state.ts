import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { decryptSensitive, encryptSensitive } from "@/lib/server/crypto";
import type { PublicProspect } from "@/server/demo-store";

const provenanceSchema = z
  .object({
    sourceType: z.enum(["APIFY", "DEMO"]),
    provider: z.string().min(1).max(200),
    collectedAt: z.string().datetime(),
  })
  .passthrough();

const normalizedSchema = z
  .object({
    mode: z.enum(["B2B", "B2C"]),
    provenance: provenanceSchema,
    rawHash: z.string().min(1).max(500),
  })
  .passthrough();

const storedResultSchema = z
  .object({
    id: z.string().min(1).max(200),
    searchId: z.string().min(1).max(200),
    mode: z.enum(["B2B", "B2C"]),
    name: z.string().min(1).max(1_000),
    title: z.string().max(1_000).optional(),
    company: z.string().max(1_000).optional(),
    industry: z.string().max(1_000).optional(),
    companySize: z.string().max(500).optional(),
    location: z.string().max(1_000).optional(),
    email: z.string().max(2_000).optional(),
    phone: z.string().max(200).optional(),
    linkedin: z.string().max(4_000).optional(),
    website: z.string().max(4_000).optional(),
    leadFields: z
      .record(z.string(), z.union([z.string(), z.number(), z.null()]))
      .optional(),
    score: z.number().min(0).max(100),
    rank: z.number().int().min(1).max(1_000_000),
    status: z.enum(["verified", "likely", "unverified", "suppressed"]),
    buyingIntent: z.enum(["LOW", "MEDIUM", "HIGH"]),
    summary: z.string().max(100_000),
    reasons: z.array(z.string().max(10_000)).max(100),
    suggestedOffer: z.string().max(100_000),
    decisionMakerConfidence: z.number().min(0).max(100),
    recommendedChannel: z.enum([
      "EMAIL",
      "LINKEDIN",
      "PHONE",
      "WHATSAPP",
      "REVIEW_REQUIRED",
    ]),
    scoreBreakdown: z.record(z.string(), z.number()),
    isSuppressed: z.boolean(),
    consentStatus: z
      .enum(["GRANTED", "DENIED", "WITHDRAWN", "NOT_REQUIRED", "UNKNOWN"])
      .optional(),
    evidence: z
      .array(
        z
          .object({
            field: z.string().max(1_000),
            provider: z.string().max(1_000),
            sourceUrl: z.string().max(4_000).optional(),
            observedAt: z.string().datetime(),
            confidence: z.number().min(0).max(100),
          })
          .passthrough(),
      )
      .max(1_000),
    normalized: normalizedSchema,
    createdAt: z.string().datetime(),
  })
  .passthrough();

const storedListSchema = z
  .object({
    id: z.string().min(1).max(200),
    name: z.string().min(1).max(120),
    description: z.string().max(1_000).optional(),
    folderId: z.string().max(200).optional(),
    resultIds: z.array(z.string().min(1).max(200)).max(100_000),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

const payloadSchema = z
  .object({
    updatedAt: z.string().datetime(),
    results: z.array(storedResultSchema).max(100_000),
    lists: z.array(storedListSchema).max(100_000),
  })
  .strict();

const envelopeSchema = z
  .object({
    version: z.literal(1),
    ciphertext: z.string().min(1).max(250_000_000),
  })
  .strict();

export type StoredLocalList = z.infer<typeof storedListSchema>;
export type LocalLiveState = {
  updatedAt: string;
  results: PublicProspect[];
  lists: StoredLocalList[];
};

function defaultStatePath() {
  return path.join(process.cwd(), ".athreix", "live-state.enc.json");
}

function emptyState(): LocalLiveState {
  return {
    updatedAt: new Date(0).toISOString(),
    results: [],
    lists: [],
  };
}

export function readLocalLiveState(
  filePath = defaultStatePath(),
): LocalLiveState {
  try {
    const envelope = envelopeSchema.parse(
      JSON.parse(readFileSync(filePath, "utf8")),
    );
    const payload = payloadSchema.parse(
      JSON.parse(decryptSensitive(envelope.ciphertext)),
    );
    return {
      ...payload,
      results: payload.results as PublicProspect[],
    };
  } catch {
    return emptyState();
  }
}

export function prepareLocalLiveStateForStartup(
  state: LocalLiveState,
  searches: Array<{ id: string; retentionUntil: string }>,
  now = new Date(),
): LocalLiveState {
  const retainedSearchIds = new Set(
    searches
      .filter((search) => new Date(search.retentionUntil) > now)
      .map((search) => search.id),
  );
  const results = state.results.filter((result) =>
    retainedSearchIds.has(result.searchId),
  );
  const retainedResultIds = new Set(results.map((result) => result.id));
  return {
    ...state,
    updatedAt: now.toISOString(),
    results,
    lists: state.lists.map((list) => ({
      ...list,
      resultIds: list.resultIds.filter((id) => retainedResultIds.has(id)),
    })),
  };
}

export function writeLocalLiveState(
  input: Pick<LocalLiveState, "results" | "lists">,
  filePath = defaultStatePath(),
) {
  const payload = payloadSchema.parse({
    updatedAt: new Date().toISOString(),
    results: input.results,
    lists: input.lists,
  });
  const envelope = envelopeSchema.parse({
    version: 1,
    ciphertext: encryptSensitive(JSON.stringify(payload)),
  });
  const directory = path.dirname(filePath);
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  mkdirSync(directory, { recursive: true });
  writeFileSync(temporaryPath, `${JSON.stringify(envelope)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  renameSync(temporaryPath, filePath);
}

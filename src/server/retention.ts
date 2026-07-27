import { ApifyClient } from "apify-client";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import { firebaseStorage } from "@/lib/server/firebase-admin";
import { writeAudit } from "@/server/audit";
import { removeApifySourceArtifacts } from "@/server/provider-cleanup";

const providerBatchSize = 25;
const providerConcurrency = 5;
const externalDeadlineMs = 3_000;

async function withDeadline<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Retention cleanup timed out")),
        timeoutMs,
      ),
    ),
  ]);
}

async function concurrentMap<T, R>(
  items: T[],
  concurrency: number,
  operation: (item: T) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await operation(items[index]!);
      }
    }),
  );
  return results;
}

export async function runRetention(now = new Date()) {
  const [expiredExports, expiredSources] = await Promise.all([
    db.export.findMany({
      where: { expiresAt: { lte: now } },
      select: { id: true, storagePath: true },
      orderBy: { expiresAt: "asc" },
      take: 250,
    }),
    db.dataSourceRecord.findMany({
      where: { retentionUntil: { lte: now } },
      select: { id: true, provider: true, datasetId: true, externalId: true },
      orderBy: { retentionUntil: "asc" },
      take: providerBatchSize,
    }),
  ]);

  // Local expiry is deliberately first. Provider/storage latency must never
  // prevent personal data from becoming unavailable inside Athreix.
  const localCounts = await db.$transaction(async (tx) => {
    await tx.export.updateMany({
      where: { id: { in: expiredExports.map((item) => item.id) } },
      data: { status: "EXPIRED" },
    });
    const results = await tx.searchResult.deleteMany({
      where: { retentionUntil: { lte: now } },
    });
    const evidence = await tx.evidence.deleteMany({
      where: { expiresAt: { lte: now } },
    });
    const contacts = await tx.contact.deleteMany({
      where: { retentionUntil: { lte: now }, results: { none: {} } },
    });
    const consumers = await tx.consumerProspect.deleteMany({
      where: { retentionUntil: { lte: now }, results: { none: {} } },
    });
    const consentProofsCleared = await tx.consentRecord.updateMany({
      where: { expiresAt: { lte: now }, proofEncrypted: { not: null } },
      data: { proofEncrypted: null },
    });
    const searchesAnonymized = await tx.search.updateMany({
      where: { retentionUntil: { lte: now } },
      data: {
        name: "Expired search",
        query: "",
        purpose: "Expired prospect research",
        legitimateInterestAssessment: null,
        filters: Prisma.DbNull,
        audienceSourceReference: null,
        errorMessage: null,
      },
    });
    const privacyPayloadsCleared = await tx.dataSubjectRequest.updateMany({
      where: {
        status: { in: ["COMPLETE", "REJECTED"] },
        updatedAt: { lte: new Date(now.getTime() - 30 * 86_400_000) },
        requestEncrypted: { not: "" },
      },
      data: { requestEncrypted: "" },
    });
    return {
      searchResults: results.count,
      evidence: evidence.count,
      professionalContacts: contacts.count,
      consumers: consumers.count,
      consentProofsCleared: consentProofsCleared.count,
      searchesAnonymized: searchesAnonymized.count,
      privacyPayloadsCleared: privacyPayloadsCleared.count,
    };
  });

  const removableExportIds = expiredExports
    .filter((item) => !item.storagePath)
    .map((item) => item.id);
  const storedExports = expiredExports.filter((item) => item.storagePath);
  let exportStorageFailures = 0;
  if (storedExports.length) {
    try {
      await withDeadline(
        Promise.all(
          storedExports.map((item) =>
            firebaseStorage
              .bucket()
              .file(item.storagePath!)
              .delete({ ignoreNotFound: true }),
          ),
        ),
        externalDeadlineMs,
      );
      removableExportIds.push(...storedExports.map((item) => item.id));
    } catch {
      exportStorageFailures = storedExports.length;
    }
  } else {
    exportStorageFailures = storedExports.length;
  }

  const apify = env.APIFY_TOKEN
    ? new ApifyClient({ token: env.APIFY_TOKEN })
    : null;
  const sourceOutcomes = await concurrentMap(
    expiredSources,
    providerConcurrency,
    async (source) => {
      if (source.provider !== "apify") return { id: source.id, removed: true };
      if (!apify) return { id: source.id, removed: false };
      const removal = await removeApifySourceArtifacts(
        apify,
        source,
        externalDeadlineMs,
      );
      return { id: source.id, removed: removal.complete };
    },
  );
  const removableSourceIds = sourceOutcomes
    .filter((item) => item.removed)
    .map((item) => item.id);
  const retrySourceIds = sourceOutcomes
    .filter((item) => !item.removed)
    .map((item) => item.id);
  const retryExportIds = expiredExports
    .filter((item) => !removableExportIds.includes(item.id))
    .map((item) => item.id);
  const nextRetry = new Date(now.getTime() + 60 * 60 * 1_000);
  const [sourceRecords, exportsRemoved] = await db.$transaction([
    db.dataSourceRecord.deleteMany({
      where: { id: { in: removableSourceIds } },
    }),
    db.export.deleteMany({ where: { id: { in: removableExportIds } } }),
    db.dataSourceRecord.updateMany({
      where: { id: { in: retrySourceIds } },
      data: { retentionUntil: nextRetry },
    }),
    db.export.updateMany({
      where: { id: { in: retryExportIds } },
      data: { expiresAt: nextRetry, status: "EXPIRED" },
    }),
  ]);

  const counts = {
    ...localCounts,
    sourceRecords: sourceRecords.count,
    exports: exportsRemoved.count,
    exportStorageFailures,
    providerCleanupFailures: retrySourceIds.length,
    providerBatchRemaining: expiredSources.length === providerBatchSize,
  };
  await writeAudit({
    action: "retention.run",
    entityType: "system",
    metadata: { ...counts, cutoff: now.toISOString() },
  });
  return counts;
}

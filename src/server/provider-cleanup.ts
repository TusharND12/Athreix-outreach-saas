import type { ApifyClient } from "apify-client";

function notFound(error: unknown) {
  return Boolean(
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    error.statusCode === 404,
  );
}

async function withDeadline<T>(promise: Promise<T>, timeoutMs: number) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Provider cleanup timed out")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function removeArtifact(
  operation: (() => Promise<unknown>) | undefined,
  timeoutMs: number,
) {
  if (!operation) return true;
  try {
    await withDeadline(operation(), timeoutMs);
    return true;
  } catch (error) {
    return notFound(error);
  }
}

export async function removeApifySourceArtifacts(
  client: ApifyClient,
  source: { datasetId?: string | null; externalId?: string | null },
  timeoutMs = 5_000,
) {
  const [datasetRemoved, runRemoved] = await Promise.all([
    removeArtifact(
      source.datasetId
        ? () => client.dataset(source.datasetId!).delete()
        : undefined,
      timeoutMs,
    ),
    removeArtifact(
      source.externalId
        ? () => client.run(source.externalId!).delete()
        : undefined,
      timeoutMs,
    ),
  ]);
  return {
    datasetRemoved,
    runRemoved,
    complete: datasetRemoved && runRemoved,
  };
}

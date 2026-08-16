export const MAX_PROVIDER_CANDIDATES = 1_000;

function normalizedTargetCount(targetCount: number) {
  if (!Number.isFinite(targetCount)) return 1;
  return Math.max(
    1,
    Math.min(MAX_PROVIDER_CANDIDATES, Math.trunc(targetCount)),
  );
}

export function candidateCollectionTarget(
  targetCount: number,
  filters: Record<string, unknown> = {},
) {
  const requested = normalizedTargetCount(targetCount);
  const configuredThreshold = filters.scoreThreshold;
  const scoreThreshold =
    typeof configuredThreshold === "number" &&
    Number.isFinite(configuredThreshold)
      ? configuredThreshold
      : 0;
  // Qualification, suppression, structured filters, and identity deduplication
  // all happen after collection.  A deep initial pool avoids treating a thin
  // provider sample as genuine source exhaustion.
  const multiplier = scoreThreshold >= 80 ? 15 : scoreThreshold >= 65 ? 12 : 10;
  return Math.min(MAX_PROVIDER_CANDIDATES, requested * multiplier);
}

export function candidateRefillTarget(input: {
  delivered: number;
  requested: number;
  received: number;
  candidateTarget: number;
}) {
  const requested = normalizedTargetCount(input.requested);
  if (input.delivered >= requested) return null;
  if (input.candidateTarget >= MAX_PROVIDER_CANDIDATES) return null;
  if (input.received < input.candidateTarget) return null;
  return MAX_PROVIDER_CANDIDATES;
}

export function meetsScoreThreshold(
  score: number,
  filters: Record<string, unknown>,
) {
  const configured = filters.scoreThreshold;
  const threshold =
    typeof configured === "number" && Number.isFinite(configured)
      ? Math.max(0, Math.min(100, Math.trunc(configured)))
      : 0;
  return score >= threshold;
}

export function selectTopQualified<T extends { score: number }>(
  candidates: T[],
  targetCount: number,
) {
  return [...candidates]
    .sort((left, right) => right.score - left.score)
    .slice(0, normalizedTargetCount(targetCount));
}

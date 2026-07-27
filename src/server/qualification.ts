const MAX_PROVIDER_CANDIDATES = 1_000;

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
  const multiplier = scoreThreshold >= 80 ? 5 : scoreThreshold >= 65 ? 3 : 2;
  return Math.min(MAX_PROVIDER_CANDIDATES, requested * multiplier);
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

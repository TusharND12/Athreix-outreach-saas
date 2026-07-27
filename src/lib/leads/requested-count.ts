const MAX_REQUESTED_LEADS = 1_000;

const countPatterns = [
  /\b(\d{1,3}(?:,\d{3})*)\s+(?:qualified\s+)?(?:leads?|prospects?|contacts?)\b/i,
  /\b(?:leads?|prospects?|contacts?)\s*(?:count|limit)?\s*[:=]?\s*(\d{1,3}(?:,\d{3})*)\b/i,
];

export function requestedLeadCountFromBrief(brief: string) {
  for (const pattern of countPatterns) {
    const match = brief.match(pattern);
    if (!match?.[1]) continue;
    const count = Number(match[1].replaceAll(",", ""));
    if (Number.isInteger(count) && count >= 1 && count <= MAX_REQUESTED_LEADS)
      return count;
  }
  return undefined;
}

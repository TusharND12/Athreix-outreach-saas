export type CsrfRequestFacts = {
  method: string;
  origin: string | null;
  secFetchSite: string | null;
  requestOrigin: string;
  configuredOrigin?: string;
};

export function csrfViolation(facts: CsrfRequestFacts): string | null {
  if (["GET", "HEAD", "OPTIONS"].includes(facts.method.toUpperCase()))
    return null;
  if (facts.secFetchSite?.toLowerCase() === "cross-site") {
    return "Cross-site mutation requests are not allowed.";
  }
  if (!facts.origin) return null;
  const allowed = new Set(
    [facts.requestOrigin, facts.configuredOrigin]
      .filter((value): value is string => Boolean(value))
      .map((value) => {
        try {
          return new URL(value).origin;
        } catch {
          return "";
        }
      })
      .filter(Boolean),
  );
  let origin: string;
  try {
    origin = new URL(facts.origin).origin;
  } catch {
    return "The request Origin is invalid.";
  }
  return allowed.has(origin) ? null : "The request Origin is not allowed.";
}

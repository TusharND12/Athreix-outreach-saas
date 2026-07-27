import { explicitFilterRatios } from "@/server/filtering";
import type { NormalizedProspect } from "@/server/normalize";

export type ScoreBreakdown = Record<string, number>;

export type ScoreResult = {
  score: number;
  breakdown: ScoreBreakdown;
  intent: "LOW" | "MEDIUM" | "HIGH";
  confidence: number;
  reasons: string[];
};

type ScoreContext = {
  query: string;
  filters: Record<string, unknown>;
};

function tokens(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((token) => token.length > 2);
}

function overlap(haystack: string, needles: string[]) {
  if (!needles.length) return 0.65;
  const normalized = haystack.toLowerCase();
  return (
    needles.filter((needle) => normalized.includes(needle)).length /
    needles.length
  );
}

function weighted(max: number, fraction: number) {
  return Math.round(max * Math.max(0, Math.min(1, fraction)));
}

function intentFor(score: number): ScoreResult["intent"] {
  if (score >= 82) return "HIGH";
  if (score >= 62) return "MEDIUM";
  return "LOW";
}

export function scoreProspect(
  item: NormalizedProspect,
  context: ScoreContext,
): ScoreResult {
  const queryTokens = tokens(context.query);
  const explicit = explicitFilterRatios(item, context.filters);
  if (item.mode === "B2C") {
    const text = [
      item.consumer.location,
      item.consumer.ageBand,
      ...item.consumer.interests,
    ].join(" ");
    const consent =
      item.consumer.consentStatus === "GRANTED"
        ? 25
        : item.consumer.consentStatus === "NOT_REQUIRED"
          ? 14
          : 0;
    const breakdown: ScoreBreakdown = {
      consent,
      audienceMatch: weighted(
        20,
        explicit.interests ?? overlap(text, queryTokens),
      ),
      location:
        explicit.location !== null
          ? weighted(9, explicit.location)
          : item.consumer.location
            ? 9
            : 3,
      interests:
        explicit.interests !== null
          ? weighted(15, explicit.interests)
          : item.consumer.interests.length
            ? weighted(15, Math.min(1, item.consumer.interests.length / 3))
            : 3,
      contactability: item.consumer.email || item.consumer.phone ? 10 : 0,
      freshness: item.consumer.consentCapturedAt ? 10 : 5,
      sourceConfidence: item.provenance.sourceType === "DEMO" ? 8 : 10,
    };
    const score = Math.min(
      100,
      Object.values(breakdown).reduce((sum, value) => sum + value, 0),
    );
    return {
      score,
      breakdown,
      intent: intentFor(score),
      confidence: item.consumer.consentStatus === "UNKNOWN" ? 55 : 84,
      reasons: [
        consent > 0
          ? "Permission state is documented"
          : "Permission must be confirmed before outreach",
        item.consumer.interests.length
          ? "Declared interests align with the audience"
          : "Limited interest evidence",
        item.consumer.location
          ? "Location is available for relevance checks"
          : "Location evidence is incomplete",
      ],
    };
  }

  const companyText = [
    item.company.name,
    item.company.industry,
    item.company.location,
    item.company.description,
    item.company.employeeRange,
    item.company.revenueRange,
    item.company.fundingStage,
    ...item.company.technologies,
    ...item.company.keywords,
  ].join(" ");
  const title = (item.contact.title ?? "").toLowerCase();
  const isDecisionMaker =
    /\b(founder|owner|chief|ceo|cto|cmo|cro|president|vp|vice president|director|head)\b/.test(
      title,
    );
  const employeeMatch = item.company.employeeCount
    ? 0.9
    : item.company.employeeRange
      ? 0.7
      : 0.35;
  const employeeFilterConfigured =
    typeof context.filters.employeeMin === "number" ||
    typeof context.filters.employeeMax === "number";
  const revenueFilterConfigured =
    typeof context.filters.revenueMin === "number" ||
    typeof context.filters.revenueMax === "number";
  const breakdown: ScoreBreakdown = {
    decisionMaker:
      explicit.title !== null
        ? weighted(18, explicit.title)
        : isDecisionMaker
          ? 18
          : title
            ? 9
            : 2,
    industryMatch: weighted(
      14,
      explicit.industry ??
        overlap(item.company.industry ?? companyText, queryTokens),
    ),
    companySize: weighted(12, employeeFilterConfigured ? 1 : employeeMatch),
    revenue: revenueFilterConfigured ? 7 : item.company.revenueRange ? 7 : 3,
    keywords: weighted(
      10,
      explicit.keywords ?? overlap(companyText, queryTokens),
    ),
    location:
      explicit.location !== null
        ? weighted(8, explicit.location)
        : item.company.location
          ? weighted(
              8,
              Math.max(0.6, overlap(item.company.location, queryTokens)),
            )
          : 2,
    companyType: item.company.foundedYear ? 4 : 2,
    technologyMatch:
      explicit.technologies !== null
        ? weighted(10, explicit.technologies)
        : item.company.technologies.length
          ? weighted(
              10,
              Math.max(
                0.6,
                overlap(item.company.technologies.join(" "), queryTokens),
              ),
            )
          : 2,
    websiteQuality: weighted(5, (item.company.websiteQuality ?? 60) / 100),
    hiring: item.company.isHiring ? 5 : 2,
    funding: item.company.fundingStage ? 5 : 2,
  };
  const score = Math.min(
    100,
    Object.values(breakdown).reduce((sum, value) => sum + value, 0),
  );
  return {
    score,
    breakdown,
    intent: intentFor(score),
    confidence: Math.min(
      96,
      58 +
        (item.company.domain ? 10 : 0) +
        (item.contact.title ? 10 : 0) +
        (item.sourceUrl ? 8 : 0),
    ),
    reasons: [
      isDecisionMaker
        ? "Role indicates decision authority"
        : "Role relevance needs review",
      item.company.employeeCount || item.company.employeeRange
        ? "Company-size evidence is available"
        : "Company size is unverified",
      item.company.technologies.length
        ? "Relevant technology signals are present"
        : "Technology evidence is limited",
      item.company.isHiring
        ? "Active hiring suggests current investment"
        : "No current hiring signal",
    ],
  };
}

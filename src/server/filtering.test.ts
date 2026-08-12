import { describe, expect, it } from "vitest";
import {
  removeIndustryEquivalentKeywords,
  structuredFilterDecision,
} from "@/server/filtering";
import { normalizeProspect } from "@/server/normalize";
import { scoreProspect } from "@/server/scoring";

const provenance = {
  sourceType: "DEMO" as const,
  provider: "test",
  collectedAt: "2026-07-20T00:00:00.000Z",
};

describe("structured filter enforcement", () => {
  const item = normalizeProspect(
    {
      companyName: "Acme AI",
      contactName: "Asha Rao",
      title: "Founder",
      industry: "Artificial intelligence",
      city: "Mumbai",
      country: "India",
      employeeCount: 75,
      revenueRange: "$5M-$10M",
      foundedYear: 2021,
      technologies: ["OpenRouter", "Next.js"],
      keywords: ["enterprise automation"],
    },
    "B2B",
    provenance,
  );

  it("hard-rejects records that miss explicit filters", () => {
    if (!item || item.mode !== "B2B") throw new Error("normalization failed");
    expect(
      structuredFilterDecision(item, {
        industries: ["Manufacturing"],
        employeeMin: 100,
      }),
    ).toMatchObject({ eligible: false });
  });

  it("uses explicit matched filters in the auditable score", () => {
    if (!item || item.mode !== "B2B") throw new Error("normalization failed");
    const filters = {
      industries: ["Artificial intelligence"],
      locations: ["Mumbai"],
      employeeMin: 20,
      employeeMax: 200,
      jobTitles: ["Founder"],
      technologies: ["OpenRouter"],
    };
    expect(structuredFilterDecision(item, filters).eligible).toBe(true);
    const score = scoreProspect(item, { query: "generic companies", filters });
    expect(score.breakdown).toMatchObject({
      decisionMaker: 18,
      industryMatch: 14,
      companySize: 12,
      location: 8,
      technologyMatch: 10,
    });
  });

  it("matches provider industry aliases and treats a false hiring toggle as unset", () => {
    const healthcareFounder = normalizeProspect(
      {
        companyName: "Care Labs",
        contactName: "Mira Shah",
        title: "Founder",
        industry: "Hospital & Health Care",
      },
      "B2B",
      provenance,
    );
    if (!healthcareFounder || healthcareFounder.mode !== "B2B") {
      throw new Error("normalization failed");
    }

    expect(
      structuredFilterDecision(healthcareFounder, {
        industries: ["Healthcare"],
        isHiring: false,
      }),
    ).toEqual({ eligible: true, reasons: [] });
    expect(
      scoreProspect(healthcareFounder, {
        query: "founder in health care",
        filters: { industries: ["Healthcare"] },
      }).breakdown.industryMatch,
    ).toBe(14);
    expect(
      structuredFilterDecision(healthcareFounder, { isHiring: true }),
    ).toMatchObject({ eligible: false, reasons: ["hiring"] });
  });

  it("does not duplicate an industry label as a hard keyword constraint", () => {
    expect(
      removeIndustryEquivalentKeywords(
        ["healthcare", "patient engagement"],
        ["Healthcare"],
      ),
    ).toEqual(["patient engagement"]);
    expect(
      removeIndustryEquivalentKeywords(
        ["Hospital & Health Care", "medical devices"],
        ["Healthcare"],
      ),
    ).toEqual(["medical devices"]);
  });
});

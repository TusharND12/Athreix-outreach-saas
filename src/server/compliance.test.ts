import { describe, expect, it } from "vitest";
import { assertSearchCompliant } from "@/server/compliance";
import { createSearchSchema } from "@/server/schemas";

describe("consumer compliance gates", () => {
  const attestations = {
    authority: true as const,
    noMinors: true as const,
    noSensitiveTargeting: true as const,
    suppressionCurrent: true as const,
    draftOnly: true as const,
  };

  it("requires purpose and lawful basis for B2C research", () => {
    const input = createSearchSchema.parse({
      query: "Adults interested in productivity",
      mode: "B2C",
    });
    expect(() => assertSearchCompliant(input)).toThrowError(
      /specific, documented purpose/i,
    );
  });

  it("blocks sensitive-category and minor targeting", () => {
    const sensitive = createSearchSchema.parse({
      query: "People with a medical condition",
      mode: "B2C",
      purpose: "Permissioned research for a relevant product campaign",
      lawfulBasis: "CONSENT",
      audienceSource: "FIRST_PARTY_UPLOAD",
      audienceSourceReference: "upload:demo-permissioned-audience",
      jurisdiction: "India",
      attestations,
    });
    expect(() => assertSearchCompliant(sensitive)).toThrowError(
      /sensitive or special-category/i,
    );

    const minors = createSearchSchema.parse({
      query: "Teenagers interested in software",
      mode: "B2C",
      purpose: "Permissioned research for a relevant product campaign",
      lawfulBasis: "CONSENT",
      audienceSource: "FIRST_PARTY_UPLOAD",
      audienceSourceReference: "upload:demo-permissioned-audience",
      jurisdiction: "India",
      attestations,
    });
    expect(() => assertSearchCompliant(minors)).toThrowError(/under 18/i);
  });

  it("uses stricter B2C retention and blocks mass-message intent", () => {
    const b2c = createSearchSchema.parse({
      query: "Adults interested in productivity software",
      mode: "B2C",
      purpose: "Permissioned research for a relevant product campaign",
      lawfulBasis: "CONSENT",
      audienceSource: "FIRST_PARTY_UPLOAD",
      audienceSourceReference: "upload:demo-permissioned-audience",
      jurisdiction: "India",
      attestations,
    });
    expect(assertSearchCompliant(b2c).retentionDays).toBe(30);

    const spam = createSearchSchema.parse({
      query: "Scrape and email everyone in Mumbai",
      mode: "B2B",
    });
    expect(() => assertSearchCompliant(spam)).toThrowError(
      /unsolicited mass messaging/i,
    );
  });

  it("requires all five consumer-use attestations", () => {
    const b2c = createSearchSchema.parse({
      query: "Adults interested in productivity software",
      mode: "B2C",
      purpose: "Permissioned research for a relevant product campaign",
      lawfulBasis: "CONSENT",
      audienceSource: "FIRST_PARTY_UPLOAD",
      audienceSourceReference: "upload:demo-permissioned-audience",
      jurisdiction: "India",
    });
    expect(() => assertSearchCompliant(b2c)).toThrowError(/Confirm authority/i);
  });

  it("blocks protected-trait targeting in professional research too", () => {
    const b2b = createSearchSchema.parse({
      query: "Find executives by religion",
      mode: "B2B",
    });
    expect(() => assertSearchCompliant(b2b)).toThrowError(
      /sensitive or special-category/i,
    );
  });

  it("cannot hide sensitive or minor targeting in supporting text", () => {
    const purposeBypass = createSearchSchema.parse({
      query: "Adults interested in skincare",
      mode: "B2C",
      purpose: "Permissioned campaign targeting pregnant customers",
      lawfulBasis: "CONSENT",
      audienceSource: "FIRST_PARTY_UPLOAD",
      audienceSourceReference: "upload:demo-permissioned-audience",
      jurisdiction: "India",
      attestations,
    });
    expect(() => assertSearchCompliant(purposeBypass)).toThrowError(
      /sensitive or special-category/i,
    );

    const nameBypass = createSearchSchema.parse({
      name: "Teen buyers",
      query: "People interested in skincare",
      mode: "B2C",
      purpose: "Permissioned product relevance research",
      lawfulBasis: "CONSENT",
      audienceSource: "FIRST_PARTY_UPLOAD",
      audienceSourceReference: "upload:demo-permissioned-audience",
      jurisdiction: "India",
      attestations,
    });
    expect(() => assertSearchCompliant(nameBypass)).toThrowError(/under 18/i);
  });
});

describe("search filter range validation", () => {
  it.each([
    [{ revenueMin: 200, revenueMax: 100 }, /minimum revenue/i],
    [{ foundedAfter: 2024, foundedBefore: 2020 }, /founded-after/i],
  ])("rejects inverted ranges", (filters, message) => {
    expect(() =>
      createSearchSchema.parse({
        query: "SaaS founders in India",
        mode: "B2B",
        filters,
      }),
    ).toThrowError(message);
  });
});

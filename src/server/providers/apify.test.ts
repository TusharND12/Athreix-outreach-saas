import { describe, expect, it } from "vitest";
import {
  adaptApifyDatasetItems,
  apifyActorInput,
  apifyPublicErrorMessage,
  apifyRunDisposition,
  CODE_CRAFTER_LEADS_ACTOR,
  COMPASS_GOOGLE_MAPS_ACTOR,
} from "@/server/providers/apify";
import { normalizeProspect } from "@/server/normalize";

describe("Apify run completion gate", () => {
  it.each(["READY", "RUNNING"])("aborts unfinished %s runs", (status) => {
    expect(apifyRunDisposition(status)).toBe("ABORT");
  });

  it.each(["FAILED", "ABORTED", "TIMED-OUT"])(
    "rejects terminal %s runs",
    (status) => expect(apifyRunDisposition(status)).toBe("REJECT"),
  );

  it("reads only succeeded datasets", () => {
    expect(apifyRunDisposition("SUCCEEDED")).toBe("READ");
  });
});

describe("Compass Google Maps adapter", () => {
  it("builds the reviewed Actor input without internal Athreix fields", () => {
    const input = apifyActorInput(COMPASS_GOOGLE_MAPS_ACTOR, {
      workspaceId: "workspace-local",
      mode: "B2B",
      query: "AI software companies",
      purpose: "Relevant business development research",
      filters: {
        locations: ["Bengaluru, India"],
        hasEmail: true,
      },
      targetCount: 10,
    });

    expect(input).toMatchObject({
      searchStringsArray: ["AI software companies"],
      locationQuery: "Bengaluru, India",
      maxCrawledPlacesPerSearch: 10,
      website: "withWebsite",
      maximumLeadsEnrichmentRecords: 1,
      verifyLeadsEnrichmentEmails: true,
    });
    expect(input).not.toHaveProperty("purpose");
    expect(input).not.toHaveProperty("filters");
  });

  it("flattens real place and lead enrichment fields for normalization", () => {
    const items = adaptApifyDatasetItems(COMPASS_GOOGLE_MAPS_ACTOR, [
      {
        title: "Acme Software",
        website: "https://acme.example",
        categoryName: "Software company",
        categories: ["Software company", "AI"],
        address: "Bengaluru, Karnataka, India",
        city: "Bengaluru",
        countryCode: "IN",
        url: "https://maps.google.com/?cid=123",
        leadsEnrichment: [
          {
            firstName: "Asha",
            lastName: "Rao",
            fullName: "Asha Rao",
            jobTitle: "Founder",
            email: "asha@acme.example",
            linkedinProfile: "https://www.linkedin.com/in/asha-rao",
            companyEmployees: 42,
          },
        ],
      },
    ]);

    expect(items).toEqual([
      expect.objectContaining({
        companyName: "Acme Software",
        website: "https://acme.example",
        industry: "Software company",
        employeeCount: 42,
        contactName: "Asha Rao",
        title: "Founder",
        email: "asha@acme.example",
        sourceUrl: "https://www.linkedin.com/in/asha-rao",
      }),
    ]);
  });

  it("does not invent a person when a place has no enriched lead", () => {
    expect(
      adaptApifyDatasetItems(COMPASS_GOOGLE_MAPS_ACTOR, [
        {
          title: "Acme Software",
          website: "https://acme.example",
          leadsEnrichment: [],
        },
      ]),
    ).toEqual([]);
  });
});

describe("Code Crafter Leads Finder adapter", () => {
  it("always sends a bounded fetch count and mapped structured filters", () => {
    const input = apifyActorInput(CODE_CRAFTER_LEADS_ACTOR, {
      workspaceId: "workspace-local",
      mode: "B2B",
      query: "CTOs at software companies",
      purpose: "Relevant business development research",
      filters: {
        jobTitles: ["CTO", "VP Engineering"],
        locations: ["India"],
        industries: ["computer software"],
        technologies: ["TypeScript"],
        hasEmail: true,
      },
      targetCount: 25,
    });

    expect(input).toEqual({
      fetch_count: 25,
      file_name: "Athreix prospects",
      contact_job_title: ["CTO", "VP Engineering"],
      contact_location: ["india"],
      email_status: ["validated"],
      company_industry: ["computer software"],
      company_keywords: ["TypeScript"],
    });
  });

  it("routes free-text cities away from Apify's strict location enum", () => {
    const input = apifyActorInput(CODE_CRAFTER_LEADS_ACTOR, {
      workspaceId: "workspace-local",
      mode: "B2B",
      query: "steel company CEOs in Pune",
      purpose: "Relevant business development research",
      filters: {
        jobTitles: ["CEO"],
        locations: ["Pune", "India"],
        excludedLocations: ["Delhi"],
        industries: ["Manufacturing"],
        keywords: ["steel"],
      },
      targetCount: 50,
    });

    expect(input).toMatchObject({
      contact_job_title: ["CEO"],
      contact_city: ["pune"],
      contact_not_city: ["delhi"],
      company_industry: ["mechanical or industrial engineering", "machinery"],
      company_keywords: ["steel"],
    });
    expect(input).not.toHaveProperty("contact_location");
    expect(input).not.toHaveProperty("contact_not_location");
  });

  it("uses only validated country choices in the strict location field", () => {
    const input = apifyActorInput(CODE_CRAFTER_LEADS_ACTOR, {
      workspaceId: "workspace-local",
      mode: "B2B",
      query: "founders in the USA",
      purpose: "Relevant business development research",
      filters: {
        locations: ["USA"],
      },
      targetCount: 10,
    });

    expect(input).toMatchObject({
      contact_location: ["united states"],
    });
    expect(input).not.toHaveProperty("contact_city");
  });

  it("keeps provider validation errors short and actionable", () => {
    const message = apifyPublicErrorMessage(
      'Input is not valid: Field input.contact_location.0 must be equal to one of the allowed values: "united states", "germany", "india"',
    );

    expect(message).toBe(
      "A location filter could not be understood. Enter cities, states, or countries separately (for example: Pune, India).",
    );
    expect(message.length).toBeLessThan(150);
  });

  it("maps all supplied Leads Finder fields into the complete record", () => {
    const items = adaptApifyDatasetItems(CODE_CRAFTER_LEADS_ACTOR, [
      {
        first_name: "Asha",
        last_name: "Rao",
        full_name: "Asha Rao",
        job_title: "Founder",
        email: "asha@acme.example",
        mobile_number: "+91 90000 00000",
        linkedin: "https://www.linkedin.com/in/asha-rao",
        company_name: "Acme Software",
        company_website: "https://acme.example",
        company_domain: "acme.example",
        company_size: 42,
        industry: "computer software",
        company_city: "Bengaluru",
        company_country: "India",
        company_technologies: "TypeScript, PostgreSQL",
      },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      companyName: "Acme Software",
      contactName: "Asha Rao",
      email: "asha@acme.example",
      employeeCount: 42,
      technologies: ["TypeScript", "PostgreSQL"],
      _athreixLeadFields: {
        first_name: "Asha",
        full_name: "Asha Rao",
        company_name: "Acme Software",
        company_size: 42,
        company_technologies: "TypeScript, PostgreSQL",
      },
    });
  });

  it("bounds canonical keywords without truncating the complete lead field", () => {
    const allKeywords = Array.from(
      { length: 61 },
      (_, index) => `keyword-${index + 1}`,
    ).join(", ");
    const items = adaptApifyDatasetItems(CODE_CRAFTER_LEADS_ACTOR, [
      {
        full_name: "Asha Rao",
        company_name: "Acme Software",
        keywords: allKeywords,
      },
    ]);

    expect(items[0]?.keywords).toHaveLength(50);
    expect(
      (items[0]?._athreixLeadFields as { keywords?: string }).keywords,
    ).toBe(allKeywords);
    expect(
      normalizeProspect(items[0]!, "B2B", {
        sourceType: "APIFY",
        provider: "apify",
        collectedAt: "2026-07-25T00:00:00.000Z",
      }),
    ).not.toBeNull();
  });
});

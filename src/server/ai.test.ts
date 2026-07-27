import { describe, expect, it } from "vitest";
import { env } from "@/lib/server/env";
import { interpretSearchBrief, openRouterRequestOptions } from "@/server/ai";

describe("OpenRouter request bounds", () => {
  it("uses explicit per-call timeouts and retry limits", () => {
    const scoring = openRouterRequestOptions("scoring");
    const outreach = openRouterRequestOptions("outreach");
    expect(scoring).toEqual({
      timeout: env.OPENROUTER_SCORING_TIMEOUT_MS,
      maxRetries: env.OPENROUTER_SCORING_MAX_RETRIES,
    });
    expect(outreach).toEqual({
      timeout: env.OPENROUTER_OUTREACH_TIMEOUT_MS,
      maxRetries: env.OPENROUTER_OUTREACH_MAX_RETRIES,
    });
  });

  it("clips a scoring request to the remaining cooperative budget", () => {
    expect(openRouterRequestOptions("scoring", 12_500, 10_000)).toMatchObject({
      timeout: 2_500,
    });
    expect(openRouterRequestOptions("scoring", 9_999, 10_000)).toBeNull();
  });

  it("keeps growth language out of deterministic location parsing", async () => {
    const result = await interpretSearchBrief({
      query: "Find SaaS startups in India hiring AI engineers",
      mode: "B2B",
      workspaceId: "workspace-demo",
      userId: "user-demo",
    });

    expect(result.filters.locations).toEqual(["India"]);
    expect(result.filters.industries).toContain("SaaS");
    expect(result.filters.jobTitles).toEqual(["AI engineers"]);
    expect(result.filters.isHiring).toBe(true);
  });

  it("extracts explicit employee thresholds from fallback search briefs", async () => {
    const result = await interpretSearchBrief({
      query: "Find builders in Pune with more than 100 employees",
      mode: "B2B",
      workspaceId: "workspace-demo",
      userId: "user-demo",
    });

    expect(result.filters.locations).toEqual(["Pune"]);
    expect(result.filters.industries).toContain("Construction");
    expect(result.filters.employeeMin).toBe(101);
  });

  it("stops a city at 'for' and extracts the company descriptor", async () => {
    const result = await interpretSearchBrief({
      query: "find a manufactures in pune for steel company ceo",
      mode: "B2B",
      workspaceId: "workspace-demo",
      userId: "user-demo",
    });

    expect(result.filters.locations).toEqual(["pune"]);
    expect(result.filters.industries).toContain("Manufacturing");
    expect(result.filters.jobTitles).toContain("CEO");
    expect(result.filters.keywords).toContain("steel");
  });

  it("normalizes a multi-sentence brief into the complete search template", async () => {
    const result = await interpretSearchBrief({
      query:
        "Find SaaS founders in Mumbai, excluding Delhi, with 20–200 employees. Require more than ₹10 crore in revenue, a public email, Series A funding, Salesforce, and an outdated website.",
      mode: "B2B",
      workspaceId: "workspace-demo",
      userId: "user-demo",
    });

    expect(result.filters).toMatchObject({
      industries: ["SaaS"],
      locations: ["Mumbai"],
      excludedLocations: ["Delhi"],
      employeeMin: 20,
      employeeMax: 200,
      revenueMin: 100_000_000,
      jobTitles: ["Founder"],
      technologies: ["Salesforce"],
      fundingStages: ["Series A"],
      emailRequirement: "AVAILABLE",
      websiteRequirement: "PRESENT",
    });
    expect(result.filters.websiteSignals).toContain("outdated website");
  });
});

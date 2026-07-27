import { describe, expect, it } from "vitest";
import { requestedLeadCountFromBrief } from "@/lib/leads/requested-count";

describe("requested lead count extraction", () => {
  it.each([
    ["Find 10 leads for steel manufacturers in Pune", 10],
    ["Show me 17 qualified prospects in India", 17],
    ["contacts: 25 for SaaS companies", 25],
    ["Return 1,000 leads", 1_000],
  ])("reads the requested count from %s", (brief, expected) => {
    expect(requestedLeadCountFromBrief(brief)).toBe(expected);
  });

  it("does not confuse company-size filters with the result count", () => {
    expect(
      requestedLeadCountFromBrief(
        "SaaS companies with 20-200 employees in India",
      ),
    ).toBeUndefined();
  });

  it("leaves unsupported counts for explicit validation", () => {
    expect(requestedLeadCountFromBrief("Find 5000 leads")).toBeUndefined();
  });
});

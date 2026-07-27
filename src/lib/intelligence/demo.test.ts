import { describe, expect, it } from "vitest";
import { demoCompanyIntelligence } from "@/lib/intelligence/demo";

describe("demo company intelligence identity", () => {
  it("keeps buying-signal IDs unique across companies", () => {
    const signalIds = demoCompanyIntelligence.flatMap((company) =>
      company.buyingSignals.map((signal) => signal.id),
    );

    expect(new Set(signalIds).size).toBe(signalIds.length);
  });
});

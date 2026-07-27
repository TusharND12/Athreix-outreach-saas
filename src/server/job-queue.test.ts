import { describe, expect, it } from "vitest";
import {
  queueReconciliationIsAccepted,
  queueStateIsClaimed,
  shouldRunSearchInline,
} from "@/server/job-queue";

describe("search queue dispatch safety", () => {
  it.each(["CLAIMED", "UNCERTAIN"] as const)(
    "treats %s reconciliation as accepted without production inline work",
    (state) => {
      expect(queueReconciliationIsAccepted(state)).toBe(true);
      expect(shouldRunSearchInline(false, "production")).toBe(false);
    },
  );

  it("keeps inline fallback available only outside production", () => {
    expect(shouldRunSearchInline(false, "development")).toBe(true);
    expect(shouldRunSearchInline(true, "development")).toBe(false);
  });

  it.each(["active", "completed", "failed"])(
    "does not remove a queue job in %s state",
    (state) => expect(queueStateIsClaimed(state)).toBe(true),
  );
});

import { describe, expect, it } from "vitest";
import {
  candidateCollectionTarget,
  candidateRefillTarget,
  meetsScoreThreshold,
  selectTopQualified,
} from "@/server/qualification";

describe("qualified lead delivery targets", () => {
  it.each([
    [1, 12],
    [10, 120],
    [25, 300],
    [100, 1_000],
  ])(
    "collects extra candidates for a requested count of %i",
    (requested, expectedCandidates) => {
      expect(candidateCollectionTarget(requested, { scoreThreshold: 65 })).toBe(
        expectedCandidates,
      );
    },
  );

  it("collects more candidates for strict qualification without exceeding the provider cap", () => {
    expect(candidateCollectionTarget(10, { scoreThreshold: 80 })).toBe(150);
    expect(candidateCollectionTarget(10, { scoreThreshold: 0 })).toBe(100);
    expect(candidateCollectionTarget(500, { scoreThreshold: 80 })).toBe(1_000);
    expect(candidateCollectionTarget(1_000, { scoreThreshold: 0 })).toBe(1_000);
  });

  it("refills a saturated pool when the requested qualified count is still short", () => {
    expect(
      candidateRefillTarget({
        delivered: 5,
        requested: 10,
        received: 120,
        candidateTarget: 120,
      }),
    ).toBe(1_000);
  });

  it("does not refill an exhausted, complete, or already-maximized pool", () => {
    expect(
      candidateRefillTarget({
        delivered: 5,
        requested: 10,
        received: 119,
        candidateTarget: 120,
      }),
    ).toBeNull();
    expect(
      candidateRefillTarget({
        delivered: 10,
        requested: 10,
        received: 120,
        candidateTarget: 120,
      }),
    ).toBeNull();
    expect(
      candidateRefillTarget({
        delivered: 5,
        requested: 10,
        received: 1_000,
        candidateTarget: 1_000,
      }),
    ).toBeNull();
  });

  it("returns exactly the requested number of highest-scoring qualified leads", () => {
    const candidates = Array.from({ length: 30 }, (_, index) => ({
      id: `lead-${index + 1}`,
      score: index + 1,
    }));
    const selected = selectTopQualified(candidates, 10);
    expect(selected).toHaveLength(10);
    expect(selected.map((item) => item.score)).toEqual([
      30, 29, 28, 27, 26, 25, 24, 23, 22, 21,
    ]);
  });

  it("never invents rows when fewer qualified candidates exist", () => {
    expect(selectTopQualified([{ score: 90 }, { score: 85 }], 10)).toHaveLength(
      2,
    );
    expect(meetsScoreThreshold(79, { scoreThreshold: 80 })).toBe(false);
    expect(meetsScoreThreshold(80, { scoreThreshold: 80 })).toBe(true);
  });
});

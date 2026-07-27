import { describe, expect, it } from "vitest";
import {
  candidateCollectionTarget,
  meetsScoreThreshold,
  selectTopQualified,
} from "@/server/qualification";

describe("qualified lead delivery targets", () => {
  it.each([
    [1, 3],
    [10, 30],
    [25, 75],
    [100, 300],
  ])(
    "collects extra candidates for a requested count of %i",
    (requested, expectedCandidates) => {
      expect(candidateCollectionTarget(requested, { scoreThreshold: 65 })).toBe(
        expectedCandidates,
      );
    },
  );

  it("collects more candidates for strict qualification without exceeding the provider cap", () => {
    expect(candidateCollectionTarget(10, { scoreThreshold: 80 })).toBe(50);
    expect(candidateCollectionTarget(500, { scoreThreshold: 80 })).toBe(1_000);
    expect(candidateCollectionTarget(1_000, { scoreThreshold: 0 })).toBe(1_000);
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

import { describe, expect, it } from "vitest";
import {
  analysisStageProgress,
  AsyncSemaphore,
  mapConcurrentOrdered,
  orderedWindows,
  ResultBudget,
} from "@/server/concurrency";

describe("bounded pipeline concurrency", () => {
  it("shares a strict semaphore limit across callers", async () => {
    const semaphore = new AsyncSemaphore(4);
    let active = 0;
    let peak = 0;
    await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        semaphore.run(async () => {
          active += 1;
          peak = Math.max(peak, active);
          await Promise.resolve(index);
          active -= 1;
        }),
      ),
    );
    expect(peak).toBe(4);
  });

  it("analyzes 1000 records with bounded concurrency and persists in order", async () => {
    const source = Array.from({ length: 1_000 }, (_, index) => index);
    const persisted: number[] = [];
    let activeAnalysis = 0;
    let peakAnalysis = 0;
    let activeWrites = 0;
    let peakWrites = 0;

    for (const window of orderedWindows(source, 24)) {
      const analyzed = await mapConcurrentOrdered(
        window.items,
        6,
        async (item) => {
          activeAnalysis += 1;
          peakAnalysis = Math.max(peakAnalysis, activeAnalysis);
          await new Promise((resolve) => setTimeout(resolve, 0));
          activeAnalysis -= 1;
          return item;
        },
      );
      for (const item of analyzed) {
        activeWrites += 1;
        peakWrites = Math.max(peakWrites, activeWrites);
        await Promise.resolve();
        persisted.push(item);
        activeWrites -= 1;
      }
    }

    expect(peakAnalysis).toBe(6);
    expect(peakWrites).toBe(1);
    expect(persisted).toEqual(source);
  });

  it("settles started window work before surfacing a mapper failure", async () => {
    let completed = 0;

    await expect(
      mapConcurrentOrdered([0, 1, 2, 3], 2, async (item) => {
        if (item === 0) throw new Error("analysis failed");
        await new Promise((resolve) => setTimeout(resolve, 0));
        completed += 1;
        return item;
      }),
    ).rejects.toThrow("analysis failed");

    expect(completed).toBe(3);
  });

  it("never expands a retry beyond its remaining unique result budget", () => {
    const budget = new ResultBudget(
      250,
      Array.from({ length: 200 }, (_, index) => `existing-${index}`),
    );
    for (let index = 0; index < 1_000; index += 1) {
      budget.add(`new-${index}`);
    }
    expect(budget.count).toBe(250);
    expect(budget.full).toBe(true);
    expect(budget.add("existing-5")).toBe(true);
    expect(budget.add("overflow")).toBe(false);
  });

  it("advances progress when records are processed but excluded", () => {
    expect(
      analysisStageProgress({
        processed: 500,
        eligible: 1_000,
        delivered: 0,
        target: 1_000,
      }),
    ).toBeGreaterThan(55);
    expect(
      analysisStageProgress({
        processed: 250,
        eligible: 1_000,
        delivered: 250,
        target: 250,
      }),
    ).toBe(90);
  });
});

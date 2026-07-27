import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  prepareLocalHistoryForStartup,
  readLocalSearchHistory,
  writeLocalSearchHistory,
  type LocalSearchHistory,
} from "@/server/local-search-history";

const temporaryDirectories: string[] = [];

function temporaryHistoryPath() {
  const directory = mkdtempSync(path.join(os.tmpdir(), "athreix-history-"));
  temporaryDirectories.push(directory);
  return path.join(directory, "search-history.json");
}

function history(
  overrides: Partial<LocalSearchHistory> = {},
): LocalSearchHistory {
  const now = new Date();
  return {
    version: 1,
    updatedAt: now.toISOString(),
    searches: [
      {
        id: "search-1",
        name: "Pune steel CEOs",
        query: "Find steel company CEOs in Pune",
        mode: "B2B",
        purpose: "Relevant business development research",
        filters: { locations: ["Pune"], jobTitles: ["CEO"] },
        targetCount: 10,
        resultCount: 3,
        status: "COMPLETE",
        chargedCredits: 3,
        retentionUntil: new Date(now.getTime() + 86_400_000).toISOString(),
        createdAt: now.toISOString(),
        completedAt: now.toISOString(),
      },
    ],
    jobs: [
      {
        id: "job-1",
        searchId: "search-1",
        status: "COMPLETE",
        stage: "COMPLETE",
        progress: 100,
        provider: "apify",
        createdAt: now.toISOString(),
        completedAt: now.toISOString(),
      },
    ],
    ...overrides,
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("local live search history", () => {
  it("persists search metadata without any result records", () => {
    const filePath = temporaryHistoryPath();
    writeLocalSearchHistory(history(), filePath);

    const restored = readLocalSearchHistory(filePath);
    expect(restored.searches).toHaveLength(1);
    expect(restored.searches[0]).toMatchObject({
      query: "Find steel company CEOs in Pune",
      resultCount: 3,
      status: "COMPLETE",
    });
    expect(restored).not.toHaveProperty("results");
  });

  it("marks interrupted searches as failed when the server starts again", () => {
    const running = history({
      searches: [
        {
          ...history().searches[0]!,
          status: "RUNNING",
          completedAt: undefined,
        },
      ],
      jobs: [
        {
          ...history().jobs[0]!,
          status: "RUNNING",
          stage: "SEARCHING_COMPANIES",
          progress: 25,
          completedAt: undefined,
        },
      ],
    });

    const restored = prepareLocalHistoryForStartup(
      running,
      new Date("2026-07-25T12:00:00.000Z"),
    );
    expect(restored.searches[0]).toMatchObject({
      status: "FAILED",
      completedAt: "2026-07-25T12:00:00.000Z",
    });
    expect(restored.jobs[0]).toMatchObject({
      status: "FAILED",
      stage: "INTERRUPTED",
      progress: 100,
    });
  });
});

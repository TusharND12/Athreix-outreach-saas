import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  prepareLocalLiveStateForStartup,
  readLocalLiveState,
  writeLocalLiveState,
  type LocalLiveState,
} from "@/server/local-live-state";
import type { PublicProspect } from "@/server/demo-store";

const temporaryDirectories: string[] = [];

function temporaryStatePath() {
  const directory = mkdtempSync(path.join(os.tmpdir(), "athreix-state-"));
  temporaryDirectories.push(directory);
  return path.join(directory, "live-state.enc.json");
}

function result(overrides: Partial<PublicProspect> = {}): PublicProspect {
  const now = new Date().toISOString();
  return {
    id: "result-1",
    searchId: "search-1",
    mode: "B2B",
    name: "Ananya Rao",
    title: "Founder",
    company: "SignalNest",
    industry: "Software",
    location: "Mumbai, India",
    email: "ananya@example.com",
    score: 92,
    rank: 1,
    status: "verified",
    buyingIntent: "HIGH",
    summary: "Strong fit for the documented business purpose.",
    reasons: ["Founder at a matching company"],
    suggestedOffer: "Relevant business introduction",
    decisionMakerConfidence: 95,
    recommendedChannel: "EMAIL",
    scoreBreakdown: { role: 30 },
    isSuppressed: false,
    evidence: [
      {
        field: "company_and_role",
        provider: "approved-provider",
        observedAt: now,
        confidence: 90,
      },
    ],
    normalized: {
      mode: "B2B",
      company: {
        name: "SignalNest",
        normalizedName: "signalnest",
        technologies: [],
        keywords: [],
      },
      contact: {
        fullName: "Ananya Rao",
        normalizedName: "ananya rao",
        email: "ananya@example.com",
      },
      provenance: {
        sourceType: "APIFY",
        provider: "approved-provider",
        collectedAt: now,
      },
      rawHash: "raw-hash",
    },
    createdAt: now,
    ...overrides,
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("encrypted local live state", () => {
  it("restores retained result rows without writing contact data in plaintext", () => {
    const filePath = temporaryStatePath();
    writeLocalLiveState(
      {
        results: [result()],
        lists: [
          {
            id: "list-1",
            name: "Priority founders",
            resultIds: ["result-1"],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
      filePath,
    );

    const stored = readFileSync(filePath, "utf8");
    expect(stored).not.toContain("ananya@example.com");
    expect(stored).not.toContain("Priority founders");
    expect(readLocalLiveState(filePath)).toMatchObject({
      results: [{ id: "result-1", email: "ananya@example.com" }],
      lists: [{ id: "list-1", resultIds: ["result-1"] }],
    });
  });

  it("removes expired results and their saved-list references on startup", () => {
    const now = new Date("2026-07-26T12:00:00.000Z");
    const state: LocalLiveState = {
      updatedAt: now.toISOString(),
      results: [
        result(),
        result({ id: "result-expired", searchId: "search-expired" }),
      ],
      lists: [
        {
          id: "list-1",
          name: "Mixed retention",
          resultIds: ["result-1", "result-expired"],
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      ],
    };

    const prepared = prepareLocalLiveStateForStartup(
      state,
      [
        {
          id: "search-1",
          retentionUntil: "2026-07-27T12:00:00.000Z",
        },
        {
          id: "search-expired",
          retentionUntil: "2026-07-25T12:00:00.000Z",
        },
      ],
      now,
    );

    expect(prepared.results.map((item) => item.id)).toEqual(["result-1"]);
    expect(prepared.lists[0]?.resultIds).toEqual(["result-1"]);
  });
});

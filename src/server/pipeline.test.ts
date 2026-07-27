import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { normalizeProspect, type NormalizedProspect } from "@/server/normalize";
import {
  isCanonicalIdentityRace,
  meetsScoreThreshold,
  prioritizeConsumerRevocations,
} from "@/server/pipeline";

const provenance = {
  sourceType: "DEMO" as const,
  provider: "test",
  collectedAt: "2026-07-20T00:00:00.000Z",
};

function consumer(
  status: "GRANTED" | "DENIED" | "WITHDRAWN",
  capturedAt: string,
) {
  const item = normalizeProspect(
    {
      displayName: "Same Consumer",
      ageBand: "25-34",
      country: "India",
      email: "same@example.com",
      consentStatus: status,
      consentChannels: ["EMAIL"],
      consentCapturedAt: capturedAt,
      consentExpiresAt: "2027-07-20T00:00:00.000Z",
      consentProofReference: `receipt-${status}-${capturedAt}`,
      consentSource: "first_party_signup",
    },
    "B2C",
    provenance,
  );
  if (!item || item.mode !== "B2C") throw new Error("normalization failed");
  return item;
}

describe("pipeline safety decisions", () => {
  it("reconciles trusted negative permission events before positive dedupe", () => {
    const granted = consumer("GRANTED", "2026-07-01T00:00:00.000Z");
    const newest = consumer("WITHDRAWN", "2026-07-18T00:00:00.000Z");
    const older = consumer("DENIED", "2026-07-15T00:00:00.000Z");
    const prioritized = prioritizeConsumerRevocations(
      [granted, newest, older] satisfies NormalizedProspect[],
      new Date("2026-07-20T00:00:00.000Z"),
    );
    expect(
      prioritized.revocations.map((item) => item.consumer.consentCapturedAt),
    ).toEqual(["2026-07-15T00:00:00.000Z", "2026-07-18T00:00:00.000Z"]);
    expect(prioritized.candidates).toHaveLength(0);
  });

  it("enforces the final configured score threshold", () => {
    expect(meetsScoreThreshold(79, { scoreThreshold: 80 })).toBe(false);
    expect(meetsScoreThreshold(80, { scoreThreshold: 80 })).toBe(true);
  });

  it("recognizes Prisma unique races for canonical re-read", () => {
    const error = new Prisma.PrismaClientKnownRequestError("unique race", {
      code: "P2002",
      clientVersion: "6.19.0",
    });
    expect(isCanonicalIdentityRace(error)).toBe(true);
    expect(isCanonicalIdentityRace(new Error("other"))).toBe(false);
  });
});

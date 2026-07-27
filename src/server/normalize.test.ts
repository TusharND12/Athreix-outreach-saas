import { describe, expect, it } from "vitest";
import { dedupeProspects, normalizeProspect } from "@/server/normalize";
import { scoreProspect } from "@/server/scoring";
import {
  evaluateConsumerPermission,
  screenConsumerRecord,
} from "@/server/compliance";

const provenance = {
  sourceType: "DEMO" as const,
  provider: "test",
  collectedAt: "2026-07-20T00:00:00.000Z",
};

describe("prospect normalization and scoring", () => {
  it("normalizes and deduplicates B2B records", () => {
    const raw = {
      companyName: " Acme AI ",
      website: "https://www.acme.example/path",
      contactName: "Asha Rao",
      title: "Founder",
      email: "ASHA@ACME.EXAMPLE",
      technologies: "Next.js, OpenRouter",
    };
    const first = normalizeProspect(raw, "B2B", provenance);
    const second = normalizeProspect(raw, "B2B", provenance);
    expect(first?.mode).toBe("B2B");
    if (!first || first.mode !== "B2B" || !second)
      throw new Error("normalization failed");
    expect(first.company.domain).toBe("acme.example");
    expect(first.contact.email).toBe("asha@acme.example");
    expect(dedupeProspects([first, second])).toHaveLength(1);
    const score = scoreProspect(first, {
      query: "AI founders using OpenRouter",
      filters: {},
    });
    expect(score.score).toBeGreaterThanOrEqual(50);
    expect(score.score).toBeLessThanOrEqual(100);
  });

  it("keeps consumer permission channels explicit", () => {
    const item = normalizeProspect(
      {
        displayName: "Demo Consumer",
        ageBand: "25-34",
        interests: ["software"],
        email: "demo@example.com",
        consentStatus: "GRANTED",
        consentChannels: ["EMAIL"],
        consentCapturedAt: "2026-07-01T00:00:00.000Z",
        consentExpiresAt: "2027-07-01T00:00:00.000Z",
        consentProofReference: "permission-receipt-1",
        consentSource: "first_party_signup",
      },
      "B2C",
      provenance,
    );
    expect(item?.mode).toBe("B2C");
    if (!item || item.mode !== "B2C") throw new Error("normalization failed");
    expect(item.consumer.consentChannels).toEqual(["EMAIL"]);
    expect(item.consumer).not.toHaveProperty("title");
    expect(
      scoreProspect(item, {
        query: "adults interested in software",
        filters: {},
      }).score,
    ).toBeLessThanOrEqual(100);
    expect(
      evaluateConsumerPermission(
        item,
        "CONSENT",
        new Date("2026-07-20T00:00:00.000Z"),
      ).proofValid,
    ).toBe(true);
  });

  it("does not promote an untrusted actor consent claim into permission", () => {
    const item = normalizeProspect(
      {
        displayName: "Demo Consumer",
        ageBand: "25-34",
        interests: ["software"],
        consentStatus: "GRANTED",
        consentChannels: ["EMAIL"],
        consentCapturedAt: "2026-07-01T00:00:00.000Z",
        consentExpiresAt: "2027-07-01T00:00:00.000Z",
        consentProofReference: "unverified-claim",
        consentSource: "scraped_field",
      },
      "B2C",
      {
        sourceType: "APIFY",
        provider: "test",
        actorId: "unreviewed/actor",
        collectedAt: "2026-07-20T00:00:00.000Z",
      },
    );
    if (!item || item.mode !== "B2C") throw new Error("normalization failed");
    const permission = evaluateConsumerPermission(
      item,
      "CONSENT",
      new Date("2026-07-20T00:00:00.000Z"),
    );
    expect(permission.proofValid).toBe(false);
    expect(permission.status).toBe("UNKNOWN");

    const minor = { ...item, consumer: { ...item.consumer, ageBand: "16-24" } };
    expect(screenConsumerRecord(minor)).toMatchObject({
      eligible: false,
      reason: "minor_or_ambiguous_age_band",
    });
  });

  it("rejects unknown, sensitive, nested, and oversized provider fields", () => {
    expect(
      normalizeProspect(
        {
          companyName: "Acme",
          contactName: "Asha Rao",
          religiousBelief: "private",
        },
        "B2B",
        provenance,
      ),
    ).toBeNull();
    expect(
      normalizeProspect(
        {
          displayName: "Consumer",
          ageBand: "25-34",
          interests: [{ nested: "not allowed" }],
        },
        "B2C",
        provenance,
      ),
    ).toBeNull();
    expect(
      normalizeProspect(
        {
          companyName: "A".repeat(501),
          contactName: "Asha Rao",
        },
        "B2B",
        provenance,
      ),
    ).toBeNull();
  });

  it("requires a current consent expiry and a reachable permission channel", () => {
    const item = normalizeProspect(
      {
        displayName: "Demo Consumer",
        ageBand: "25-34",
        email: "demo@example.com",
        consentStatus: "GRANTED",
        consentChannels: ["EMAIL"],
        consentCapturedAt: "2026-07-01T00:00:00.000Z",
        consentExpiresAt: "2026-07-10T00:00:00.000Z",
        consentProofReference: "permission-receipt-expired",
        consentSource: "first_party_signup",
      },
      "B2C",
      provenance,
    );
    if (!item || item.mode !== "B2C") throw new Error("normalization failed");
    expect(
      evaluateConsumerPermission(
        item,
        "CONSENT",
        new Date("2026-07-20T00:00:00.000Z"),
      ),
    ).toMatchObject({ proofValid: false, status: "UNKNOWN", channels: [] });
  });
});

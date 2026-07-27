import { describe, expect, it } from "vitest";
import type { NormalizedProspect } from "@/server/normalize";
import {
  createProfileSnapshot,
  normalizedProspectFromSnapshot,
} from "@/server/profile-snapshot";
import { serializeDatabaseResult } from "@/server/search-service";

const observedAt = "2026-07-20T12:00:00.000Z";

describe("immutable result profile snapshots", () => {
  it("keeps older display/export fields stable after canonical mutation", () => {
    const original: NormalizedProspect = {
      mode: "B2B",
      company: {
        name: "Original Labs",
        normalizedName: "original labs",
        domain: "original.example",
        website: "https://original.example",
        industry: "AI software",
        location: "Pune, India",
        employeeRange: "20–50",
        technologies: ["TypeScript"],
        keywords: ["research"],
      },
      contact: {
        fullName: "Asha Rao",
        normalizedName: "asha rao",
        title: "Founder",
        location: "Pune, India",
        linkedinUrl: "https://www.linkedin.com/in/asha-original",
      },
      provenance: {
        sourceType: "APIFY",
        provider: "test",
        collectedAt: observedAt,
      },
      rawHash: "raw-original",
    };
    const row = {
      id: "result-1",
      searchId: "search-1",
      profileSnapshot: createProfileSnapshot(original),
      company: {
        name: "Later Company Name",
        industry: "Later industry",
        employeeRange: "500–1000",
        location: "Later location",
        website: "https://later.example",
      },
      contact: {
        fullName: "Later Person Name",
        title: "Later title",
        location: "Later location",
        linkedinUrl: "https://www.linkedin.com/in/later",
        emailMasked: "a•••@example.com",
        phoneMasked: null,
        encryptedEmail: null,
        encryptedPhone: null,
        emailVerification: "LIKELY",
        phoneVerification: "UNVERIFIED",
        decisionMakerConfidence: 10,
      },
      consumer: null,
      score: 91,
      rank: 1,
      isSuppressed: false,
      buyingIntent: "HIGH",
      summary: "Original analysis",
      reasons: ["Original evidence"],
      suggestedOffer: "Original offer",
      recommendedChannel: "EMAIL",
      confidence: 88,
      scoreBreakdown: {},
      retentionUntil: new Date("2026-10-20T00:00:00.000Z"),
      createdAt: new Date(observedAt),
    };

    const serialized = serializeDatabaseResult(row as never);
    expect(serialized).toMatchObject({
      name: "Asha Rao",
      title: "Founder",
      company: "Original Labs",
      industry: "AI software",
      companySize: "20–50",
      location: "Pune, India",
      website: "https://original.example",
      linkedin: "https://www.linkedin.com/in/asha-original",
      decisionMakerConfidence: 88,
    });
  });

  it("uses the snapshot for outreach context but current permission channels", () => {
    const original: NormalizedProspect = {
      mode: "B2C",
      consumer: {
        displayName: "Original Consumer",
        normalizedName: "original consumer",
        ageBand: "25-34",
        location: "Mumbai, India",
        country: "India",
        interests: ["productivity"],
        email: "private@example.com",
        phone: "+919876543210",
        consentStatus: "GRANTED",
        consentCapturedAt: observedAt,
        consentChannels: ["EMAIL"],
        consentProofReference: "private-proof-reference",
        consentSource: "first_party_signup",
      },
      provenance: {
        sourceType: "APIFY",
        provider: "test",
        collectedAt: observedAt,
      },
      rawHash: "consumer-original",
    };
    const snapshot = createProfileSnapshot(original);
    expect(JSON.stringify(snapshot)).not.toContain("private@example.com");
    expect(JSON.stringify(snapshot)).not.toContain("private-proof-reference");

    const outreachContext = normalizedProspectFromSnapshot(snapshot, {
      rawHash: "result-2",
      consentStatus: "GRANTED",
      consentCapturedAt: observedAt,
      consentChannels: ["WHATSAPP"],
    });
    expect(outreachContext.mode).toBe("B2C");
    if (outreachContext.mode !== "B2C") throw new Error("Expected B2C");
    expect(outreachContext.consumer.displayName).toBe("Original Consumer");
    expect(outreachContext.consumer.interests).toEqual(["productivity"]);
    expect(outreachContext.consumer.consentChannels).toEqual(["WHATSAPP"]);
  });
});

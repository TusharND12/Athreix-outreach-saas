import { z } from "zod";
import {
  compactLeadRecord,
  leadRecordWithoutSensitiveValues,
} from "@/lib/leads/columns";
import type { NormalizedProspect } from "@/server/normalize";

const optionalText = z.string().optional();
const leadFieldsSchema = z
  .record(
    z.string(),
    z.union([z.string().max(5_000), z.number().finite(), z.null()]),
  )
  .transform((value) => compactLeadRecord(value))
  .default({});
const companySnapshotSchema = z.object({
  name: z.string(),
  normalizedName: z.string(),
  domain: optionalText,
  website: optionalText,
  linkedinUrl: optionalText,
  description: optionalText,
  industry: optionalText,
  city: optionalText,
  country: optionalText,
  location: optionalText,
  employeeCount: z.number().optional(),
  employeeRange: optionalText,
  revenueRange: optionalText,
  foundedYear: z.number().optional(),
  technologies: z.array(z.string()),
  keywords: z.array(z.string()),
  fundingStage: optionalText,
  isHiring: z.boolean().optional(),
  websiteQuality: z.number().optional(),
});

const contactSnapshotSchema = z.object({
  fullName: z.string(),
  normalizedName: z.string(),
  firstName: optionalText,
  lastName: optionalText,
  title: optionalText,
  seniority: optionalText,
  location: optionalText,
  country: optionalText,
  linkedinUrl: optionalText,
});

const consumerSnapshotSchema = z.object({
  displayName: z.string(),
  normalizedName: z.string(),
  ageBand: optionalText,
  city: optionalText,
  country: optionalText,
  location: optionalText,
  interests: z.array(z.string()),
});

export const profileSnapshotSchema = z.discriminatedUnion("mode", [
  z.object({
    version: z.literal(1),
    mode: z.literal("B2B"),
    sourceType: z.enum(["APIFY", "DEMO"]),
    sourceProvider: z.string(),
    observedAt: z.string().datetime(),
    sourceUrl: optionalText,
    company: companySnapshotSchema,
    contact: contactSnapshotSchema,
    leadFields: leadFieldsSchema,
  }),
  z.object({
    version: z.literal(1),
    mode: z.literal("B2C"),
    sourceType: z.enum(["APIFY", "DEMO"]),
    sourceProvider: z.string(),
    observedAt: z.string().datetime(),
    sourceUrl: optionalText,
    consumer: consumerSnapshotSchema,
  }),
]);

export type ProfileSnapshot = z.infer<typeof profileSnapshotSchema>;

export function createProfileSnapshot(
  item: NormalizedProspect,
): ProfileSnapshot {
  if (item.mode === "B2B") {
    return profileSnapshotSchema.parse(
      JSON.parse(
        JSON.stringify({
          version: 1,
          mode: "B2B",
          sourceType: item.provenance.sourceType,
          sourceProvider: item.provenance.provider,
          observedAt: item.provenance.collectedAt,
          sourceUrl: item.sourceUrl,
          company: { ...item.company },
          contact: {
            fullName: item.contact.fullName,
            normalizedName: item.contact.normalizedName,
            firstName: item.contact.firstName,
            lastName: item.contact.lastName,
            title: item.contact.title,
            seniority: item.contact.seniority,
            location: item.contact.location,
            country: item.contact.country,
            linkedinUrl: item.contact.linkedinUrl,
          },
          leadFields: leadRecordWithoutSensitiveValues(item.leadFields),
        }),
      ),
    );
  }
  return profileSnapshotSchema.parse(
    JSON.parse(
      JSON.stringify({
        version: 1,
        mode: "B2C",
        sourceType: item.provenance.sourceType,
        sourceProvider: item.provenance.provider,
        observedAt: item.provenance.collectedAt,
        sourceUrl: item.sourceUrl,
        consumer: {
          displayName: item.consumer.displayName,
          normalizedName: item.consumer.normalizedName,
          ageBand: item.consumer.ageBand,
          city: item.consumer.city,
          country: item.consumer.country,
          location: item.consumer.location,
          interests: [...item.consumer.interests],
        },
      }),
    ),
  );
}

export function readProfileSnapshot(value: unknown): ProfileSnapshot | null {
  const parsed = profileSnapshotSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function snapshotDisplayFields(snapshot: ProfileSnapshot) {
  if (snapshot.mode === "B2C") {
    return {
      mode: "B2C" as const,
      name: snapshot.consumer.displayName,
      title: undefined,
      company: undefined,
      industry: "Consumer audience",
      companySize: undefined,
      location: snapshot.consumer.location,
      linkedin: undefined,
      website: undefined,
    };
  }
  return {
    mode: "B2B" as const,
    name: snapshot.contact.fullName,
    title: snapshot.contact.title,
    company: snapshot.company.name,
    industry: snapshot.company.industry,
    companySize: snapshot.company.employeeRange,
    location: snapshot.company.location ?? snapshot.contact.location,
    linkedin: snapshot.contact.linkedinUrl,
    website: snapshot.company.website,
    leadFields: snapshot.leadFields,
  };
}

export function normalizedProspectFromSnapshot(
  snapshot: ProfileSnapshot,
  input: {
    rawHash: string;
    consentStatus?: "GRANTED" | "DENIED" | "WITHDRAWN" | "UNKNOWN";
    consentCapturedAt?: string;
    consentChannels?: Array<"EMAIL" | "LINKEDIN" | "PHONE" | "WHATSAPP">;
  },
): NormalizedProspect {
  const provenance = {
    sourceType: snapshot.sourceType,
    provider: snapshot.sourceProvider,
    collectedAt: snapshot.observedAt,
  };
  if (snapshot.mode === "B2B") {
    return {
      mode: "B2B",
      company: { ...snapshot.company },
      contact: { ...snapshot.contact },
      leadFields: snapshot.leadFields,
      sourceUrl: snapshot.sourceUrl,
      provenance,
      rawHash: input.rawHash,
    };
  }
  return {
    mode: "B2C",
    consumer: {
      ...snapshot.consumer,
      consentStatus: input.consentStatus ?? "UNKNOWN",
      consentCapturedAt: input.consentCapturedAt,
      consentChannels: input.consentChannels ?? [],
    },
    sourceUrl: snapshot.sourceUrl,
    provenance,
    rawHash: input.rawHash,
  };
}

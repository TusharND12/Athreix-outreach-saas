import { createHash } from "node:crypto";
import { z } from "zod";
import { canonicalPhone } from "@/lib/server/crypto";
import { compactLeadRecord, type LeadRecord } from "@/lib/leads/columns";
import type { RawProspect, SourceProvenance } from "@/server/providers/types";

const shortText = z.string().trim().min(1).max(500);
const longText = z.string().trim().min(1).max(5_000);
const urlText = z.string().trim().min(1).max(2_048);
const emailText = z.string().trim().email().max(254);
const phoneText = z
  .string()
  .trim()
  .min(5)
  .max(40)
  .regex(/^[0-9+().\s-]+$/);
const numericText = z.union([
  z.number().finite(),
  z.string().trim().min(1).max(50),
]);
const booleanText = z.union([
  z.boolean(),
  z.literal(0),
  z.literal(1),
  z.literal("true"),
  z.literal("false"),
]);
const textList = z.union([
  z.string().trim().min(1).max(2_000),
  z.array(z.string().trim().min(1).max(200)).max(50),
]);
const leadFieldValue = z.union([
  z.string().trim().min(1).max(5_000),
  z.number().finite(),
]);
const leadRecordSchema = z
  .object({
    first_name: leadFieldValue.optional(),
    last_name: leadFieldValue.optional(),
    email: leadFieldValue.optional(),
    personal_email: leadFieldValue.optional(),
    mobile_number: leadFieldValue.optional(),
    full_name: leadFieldValue.optional(),
    job_title: leadFieldValue.optional(),
    linkedin: leadFieldValue.optional(),
    company_name: leadFieldValue.optional(),
    company_website: leadFieldValue.optional(),
    industry: leadFieldValue.optional(),
    company_size: leadFieldValue.optional(),
    headline: leadFieldValue.optional(),
    seniority_level: leadFieldValue.optional(),
    functional_level: leadFieldValue.optional(),
    city: leadFieldValue.optional(),
    state: leadFieldValue.optional(),
    country: leadFieldValue.optional(),
    company_linkedin: leadFieldValue.optional(),
    company_linkedin_uid: leadFieldValue.optional(),
    company_founded_year: leadFieldValue.optional(),
    company_domain: leadFieldValue.optional(),
    company_phone: leadFieldValue.optional(),
    company_street_address: leadFieldValue.optional(),
    company_full_address: leadFieldValue.optional(),
    company_state: leadFieldValue.optional(),
    company_city: leadFieldValue.optional(),
    company_country: leadFieldValue.optional(),
    company_postal_code: leadFieldValue.optional(),
    keywords: leadFieldValue.optional(),
    company_description: leadFieldValue.optional(),
    company_annual_revenue: leadFieldValue.optional(),
    company_annual_revenue_clean: leadFieldValue.optional(),
    company_total_funding: leadFieldValue.optional(),
    company_total_funding_clean: leadFieldValue.optional(),
    company_technologies: leadFieldValue.optional(),
  })
  .strict();
const researchEvidenceSchema = z
  .object({
    id: z.string().trim().min(1).max(160),
    kind: z
      .enum([
        "SEARCH",
        "MAPS",
        "WEBSITE",
        "CONTACT",
        "ABOUT",
        "SERVICES",
        "CAREERS",
        "NEWS",
        "PROFILE",
        "REVIEWS",
        "SOCIAL",
      ])
      .default("WEBSITE"),
    title: z.string().trim().min(1).max(300).optional(),
    excerpt: z.string().trim().min(1).max(2_000),
    sourceUrl: urlText.optional(),
    observedAt: z.string().datetime(),
    confidence: z.number().int().min(0).max(100),
    actorId: z.string().trim().min(1).max(200).optional(),
  })
  .strict();
const researchSignalSchema = z
  .object({
    type: z
      .enum([
        "HIRING",
        "EXPANSION",
        "WEBSITE_CHANGE",
        "TECHNOLOGY",
        "PRODUCT",
        "PARTNERSHIP",
        "NEWS",
        "REVIEWS",
        "SOCIAL",
        "OTHER",
      ])
      .default("OTHER"),
    title: z.string().trim().min(1).max(240),
    detail: z.string().trim().min(1).max(1_000),
    observedAt: z.string().datetime(),
    evidenceRefs: z.array(z.string().trim().min(1).max(160)).max(12),
    confidence: z.number().int().min(0).max(100),
    strength: z.enum(["WEAK", "MODERATE", "STRONG"]),
  })
  .strict();
const researchBundleSchema = z
  .object({
    evidence: z.array(researchEvidenceSchema).max(100).default([]),
    signals: z.array(researchSignalSchema).max(50).default([]),
    technologies: z
      .array(z.string().trim().min(1).max(120))
      .max(80)
      .default([]),
  })
  .strict();

// Actor output is an external trust boundary. These allowlists intentionally
// reject unknown fields (including accidental sensitive-category payloads),
// deeply nested values, and unbounded strings before normalization or AI use.
const rawB2BSchema = z
  .object({
    companyName: shortText.optional(),
    organizationName: shortText.optional(),
    company: shortText.optional(),
    name: shortText.optional(),
    domain: shortText.optional(),
    companyDomain: shortText.optional(),
    website: urlText.optional(),
    companyWebsite: urlText.optional(),
    companyLinkedinUrl: urlText.optional(),
    organizationLinkedinUrl: urlText.optional(),
    companyDescription: longText.optional(),
    description: longText.optional(),
    about: longText.optional(),
    industry: shortText.optional(),
    companyIndustry: shortText.optional(),
    city: shortText.optional(),
    companyCity: shortText.optional(),
    country: shortText.optional(),
    companyCountry: shortText.optional(),
    companyLocation: shortText.optional(),
    location: shortText.optional(),
    employeeCount: numericText.optional(),
    employees: numericText.optional(),
    employeeRange: shortText.optional(),
    companySize: shortText.optional(),
    revenueRange: shortText.optional(),
    annualRevenue: shortText.optional(),
    foundedYear: numericText.optional(),
    yearFounded: numericText.optional(),
    technologies: textList.optional(),
    techStack: textList.optional(),
    keywords: textList.optional(),
    companyKeywords: textList.optional(),
    fundingStage: shortText.optional(),
    isHiring: booleanText.optional(),
    hiring: booleanText.optional(),
    websiteQuality: numericText.optional(),
    contactName: shortText.optional(),
    fullName: shortText.optional(),
    personName: shortText.optional(),
    firstName: shortText.optional(),
    lastName: shortText.optional(),
    title: shortText.optional(),
    jobTitle: shortText.optional(),
    position: shortText.optional(),
    seniority: shortText.optional(),
    contactLocation: shortText.optional(),
    contactCountry: shortText.optional(),
    email: emailText.optional(),
    emailAddress: emailText.optional(),
    phone: phoneText.optional(),
    phoneNumber: phoneText.optional(),
    linkedinUrl: urlText.optional(),
    contactLinkedinUrl: urlText.optional(),
    sourceUrl: urlText.optional(),
    url: urlText.optional(),
    profileUrl: urlText.optional(),
    _athreixLeadFields: leadRecordSchema.optional(),
    _athreixResearch: researchBundleSchema.optional(),
  })
  .strict();

const rawB2CSchema = z
  .object({
    displayName: shortText.optional(),
    fullName: shortText.optional(),
    name: shortText.optional(),
    ageBand: shortText.optional(),
    city: shortText.optional(),
    country: shortText.optional(),
    location: shortText.optional(),
    interests: textList.optional(),
    keywords: textList.optional(),
    email: emailText.optional(),
    emailAddress: emailText.optional(),
    phone: phoneText.optional(),
    phoneNumber: phoneText.optional(),
    consentStatus: shortText.optional(),
    consentChannels: textList.optional(),
    permittedChannels: textList.optional(),
    consentCapturedAt: shortText.optional(),
    consentExpiresAt: shortText.optional(),
    permissionExpiresAt: shortText.optional(),
    consentProofReference: shortText.optional(),
    permissionReference: shortText.optional(),
    consentReceiptId: shortText.optional(),
    consentSource: shortText.optional(),
    permissionSource: shortText.optional(),
    sourceUrl: urlText.optional(),
    url: urlText.optional(),
    profileUrl: urlText.optional(),
  })
  .strict();

function stringValue(raw: RawProspect, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
}

function numberValue(raw: RawProspect, ...keys: string[]): number | undefined {
  const value = stringValue(raw, ...keys);
  if (!value) return undefined;
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function booleanValue(
  raw: RawProspect,
  ...keys: string[]
): boolean | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "boolean") return value;
    if (value === "true" || value === 1) return true;
    if (value === "false" || value === 0) return false;
  }
}

function stringArray(raw: RawProspect, ...keys: string[]): string[] {
  for (const key of keys) {
    const value = raw[key];
    if (Array.isArray(value)) {
      return value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);
    }
    if (typeof value === "string") {
      return value
        .split(/[,;|]/)
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function cleanDomain(value?: string) {
  if (!value) return undefined;
  try {
    return new URL(value.includes("://") ? value : `https://${value}`).hostname
      .replace(/^www\./, "")
      .toLowerCase();
  } catch {
    return value
      .toLowerCase()
      .replace(/^www\./, "")
      .split("/")[0];
  }
}

function canonicalUrl(value?: string) {
  if (!value) return undefined;
  try {
    const parsed = new URL(value.includes("://") ? value : `https://${value}`);
    if (!/^https?:$/.test(parsed.protocol)) return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export type NormalizedB2BProspect = {
  mode: "B2B";
  company: {
    name: string;
    normalizedName: string;
    domain?: string;
    website?: string;
    linkedinUrl?: string;
    description?: string;
    industry?: string;
    city?: string;
    country?: string;
    location?: string;
    employeeCount?: number;
    employeeRange?: string;
    revenueRange?: string;
    foundedYear?: number;
    technologies: string[];
    keywords: string[];
    fundingStage?: string;
    isHiring?: boolean;
    websiteQuality?: number;
  };
  contact: {
    fullName: string;
    normalizedName: string;
    firstName?: string;
    lastName?: string;
    title?: string;
    seniority?: string;
    location?: string;
    country?: string;
    email?: string;
    phone?: string;
    linkedinUrl?: string;
  };
  research?: z.infer<typeof researchBundleSchema>;
  leadFields?: LeadRecord;
  sourceUrl?: string;
  provenance: SourceProvenance;
  rawHash: string;
};

export type NormalizedB2CProspect = {
  mode: "B2C";
  consumer: {
    displayName: string;
    normalizedName: string;
    ageBand?: string;
    city?: string;
    country?: string;
    location?: string;
    interests: string[];
    email?: string;
    phone?: string;
    consentStatus:
      "GRANTED" | "DENIED" | "WITHDRAWN" | "NOT_REQUIRED" | "UNKNOWN";
    consentCapturedAt?: string;
    consentExpiresAt?: string;
    consentChannels: Array<"EMAIL" | "LINKEDIN" | "PHONE" | "WHATSAPP">;
    consentProofReference?: string;
    consentSource?: string;
  };
  sourceUrl?: string;
  provenance: SourceProvenance;
  rawHash: string;
};

export type NormalizedProspect = NormalizedB2BProspect | NormalizedB2CProspect;

export function normalizeProspect(
  raw: RawProspect,
  mode: "B2B" | "B2C",
  provenance: SourceProvenance,
): NormalizedProspect | null {
  const parsed = (mode === "B2C" ? rawB2CSchema : rawB2BSchema).safeParse(raw);
  if (!parsed.success) return null;
  raw = parsed.data;
  const rawHash = createHash("sha256")
    .update(JSON.stringify(raw))
    .digest("hex");
  const sourceUrl = canonicalUrl(
    stringValue(raw, "sourceUrl", "url", "profileUrl"),
  );
  if (mode === "B2C") {
    const displayName =
      stringValue(raw, "displayName", "fullName", "name") ?? "Consumer record";
    const consumerCountry = stringValue(raw, "country");
    const consentRaw = stringValue(raw, "consentStatus")?.toUpperCase();
    const allowedConsent = [
      "GRANTED",
      "DENIED",
      "WITHDRAWN",
      "NOT_REQUIRED",
      "UNKNOWN",
    ] as const;
    const consentStatus =
      allowedConsent.find((value) => value === consentRaw) ?? "UNKNOWN";
    const allowedChannels = ["EMAIL", "LINKEDIN", "PHONE", "WHATSAPP"] as const;
    const consentChannels = stringArray(
      raw,
      "consentChannels",
      "permittedChannels",
    )
      .map((value) => value.toUpperCase())
      .filter((value): value is (typeof allowedChannels)[number] =>
        allowedChannels.includes(value as (typeof allowedChannels)[number]),
      );
    return {
      mode,
      consumer: {
        displayName,
        normalizedName: displayName.toLowerCase().replace(/\s+/g, " "),
        ageBand: stringValue(raw, "ageBand"),
        city: stringValue(raw, "city"),
        country: consumerCountry,
        location:
          stringValue(raw, "location") ??
          [stringValue(raw, "city"), stringValue(raw, "country")]
            .filter(Boolean)
            .join(", "),
        interests: stringArray(raw, "interests", "keywords"),
        email: stringValue(raw, "email", "emailAddress")?.toLowerCase(),
        phone: canonicalPhone(
          stringValue(raw, "phone", "phoneNumber") ?? "",
          consumerCountry,
        ),
        consentStatus,
        consentCapturedAt: stringValue(raw, "consentCapturedAt"),
        consentExpiresAt: stringValue(
          raw,
          "consentExpiresAt",
          "permissionExpiresAt",
        ),
        consentChannels,
        consentProofReference: stringValue(
          raw,
          "consentProofReference",
          "permissionReference",
          "consentReceiptId",
        ),
        consentSource: stringValue(raw, "consentSource", "permissionSource"),
      },
      sourceUrl,
      provenance,
      rawHash,
    };
  }

  const companyName = stringValue(
    raw,
    "companyName",
    "organizationName",
    "company",
    "name",
  );
  const fullName = stringValue(raw, "contactName", "fullName", "personName");
  if (!companyName || !fullName) return null;
  const domain = cleanDomain(
    stringValue(raw, "domain", "companyDomain", "website"),
  );
  const companyCountry = stringValue(raw, "country", "companyCountry");
  const contactCountry = stringValue(raw, "contactCountry", "country");
  const parsedResearch = researchBundleSchema.safeParse(raw._athreixResearch);
  const research = parsedResearch.success
    ? parsedResearch.data
    : { evidence: [], signals: [], technologies: [] };
  const rawLeadFields =
    "_athreixLeadFields" in raw &&
    raw._athreixLeadFields &&
    typeof raw._athreixLeadFields === "object"
      ? (raw._athreixLeadFields as LeadRecord)
      : undefined;
  const leadFields = compactLeadRecord({
    ...rawLeadFields,
    first_name: rawLeadFields?.first_name ?? stringValue(raw, "firstName"),
    last_name: rawLeadFields?.last_name ?? stringValue(raw, "lastName"),
    full_name: rawLeadFields?.full_name ?? fullName,
    job_title:
      rawLeadFields?.job_title ??
      stringValue(raw, "title", "jobTitle", "position"),
    email: rawLeadFields?.email ?? stringValue(raw, "email", "emailAddress"),
    mobile_number:
      rawLeadFields?.mobile_number ?? stringValue(raw, "phone", "phoneNumber"),
    linkedin:
      rawLeadFields?.linkedin ??
      stringValue(raw, "linkedinUrl", "contactLinkedinUrl"),
    company_name: rawLeadFields?.company_name ?? companyName,
    company_website:
      rawLeadFields?.company_website ??
      stringValue(raw, "website", "companyWebsite"),
    company_domain:
      rawLeadFields?.company_domain ??
      stringValue(raw, "domain", "companyDomain"),
    company_linkedin:
      rawLeadFields?.company_linkedin ??
      stringValue(raw, "companyLinkedinUrl", "organizationLinkedinUrl"),
    company_description:
      rawLeadFields?.company_description ??
      stringValue(raw, "companyDescription", "description", "about"),
    industry:
      rawLeadFields?.industry ??
      stringValue(raw, "industry", "companyIndustry"),
    company_size:
      rawLeadFields?.company_size ??
      numberValue(raw, "employeeCount", "employees") ??
      stringValue(raw, "employeeRange", "companySize"),
    company_founded_year:
      rawLeadFields?.company_founded_year ??
      numberValue(raw, "foundedYear", "yearFounded"),
    company_city:
      rawLeadFields?.company_city ?? stringValue(raw, "companyCity", "city"),
    company_country:
      rawLeadFields?.company_country ??
      stringValue(raw, "companyCountry", "country"),
    company_full_address:
      rawLeadFields?.company_full_address ??
      stringValue(raw, "companyLocation", "location"),
    city: rawLeadFields?.city ?? stringValue(raw, "contactLocation", "city"),
    country:
      rawLeadFields?.country ?? stringValue(raw, "contactCountry", "country"),
    keywords:
      rawLeadFields?.keywords ??
      stringArray(raw, "keywords", "companyKeywords").join(", "),
    company_technologies:
      rawLeadFields?.company_technologies ??
      stringArray(raw, "technologies", "techStack").join(", "),
    company_annual_revenue:
      rawLeadFields?.company_annual_revenue ??
      stringValue(raw, "revenueRange", "annualRevenue"),
  });
  return {
    mode,
    company: {
      name: companyName,
      normalizedName: companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim(),
      domain,
      website: canonicalUrl(
        stringValue(raw, "website", "companyWebsite") ?? domain,
      ),
      linkedinUrl: canonicalUrl(
        stringValue(raw, "companyLinkedinUrl", "organizationLinkedinUrl"),
      ),
      description: stringValue(
        raw,
        "companyDescription",
        "description",
        "about",
      ),
      industry: stringValue(raw, "industry", "companyIndustry"),
      city: stringValue(raw, "city", "companyCity"),
      country: companyCountry,
      location:
        stringValue(raw, "companyLocation", "location") ??
        [stringValue(raw, "city"), stringValue(raw, "country")]
          .filter(Boolean)
          .join(", "),
      employeeCount: numberValue(raw, "employeeCount", "employees"),
      employeeRange: stringValue(raw, "employeeRange", "companySize"),
      revenueRange: stringValue(raw, "revenueRange", "annualRevenue"),
      foundedYear: numberValue(raw, "foundedYear", "yearFounded"),
      technologies: Array.from(
        new Set([
          ...stringArray(raw, "technologies", "techStack"),
          ...research.technologies,
        ]),
      ),
      keywords: stringArray(raw, "keywords", "companyKeywords"),
      fundingStage: stringValue(raw, "fundingStage"),
      isHiring: booleanValue(raw, "isHiring", "hiring"),
      websiteQuality: numberValue(raw, "websiteQuality"),
    },
    contact: {
      fullName,
      normalizedName: fullName.toLowerCase().replace(/\s+/g, " "),
      firstName: stringValue(raw, "firstName"),
      lastName: stringValue(raw, "lastName"),
      title: stringValue(raw, "title", "jobTitle", "position"),
      seniority: stringValue(raw, "seniority"),
      location: stringValue(raw, "contactLocation", "location"),
      country: contactCountry,
      email: stringValue(raw, "email", "emailAddress")?.toLowerCase(),
      phone: canonicalPhone(
        stringValue(raw, "phone", "phoneNumber") ?? "",
        contactCountry ?? companyCountry,
      ),
      linkedinUrl: canonicalUrl(
        stringValue(raw, "linkedinUrl", "contactLinkedinUrl"),
      ),
    },
    leadFields,
    research,
    sourceUrl,
    provenance,
    rawHash,
  };
}

export function dedupeProspects(items: NormalizedProspect[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key =
      item.mode === "B2B"
        ? `${item.company.domain ?? item.company.normalizedName}:${item.contact.email ?? item.contact.normalizedName}`
        : (item.consumer.email ??
          item.consumer.phone ??
          `${item.consumer.normalizedName}:${item.consumer.location}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

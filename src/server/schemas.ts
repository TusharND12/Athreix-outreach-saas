import { z } from "zod";

export const prospectModeSchema = z.enum(["B2B", "B2C"]);
export const lawfulBasisSchema = z.enum([
  "CONSENT",
  "CONTRACT",
  "LEGAL_OBLIGATION",
  "VITAL_INTERESTS",
  "PUBLIC_TASK",
  "LEGITIMATE_INTERESTS",
]);

export const searchFiltersSchema = z
  .object({
    industries: z.array(z.string().trim().min(1).max(100)).max(25).optional(),
    locations: z.array(z.string().trim().min(1).max(100)).max(25).optional(),
    excludedLocations: z
      .array(z.string().trim().min(1).max(100))
      .max(25)
      .optional(),
    country: z.string().trim().max(100).optional(),
    state: z.string().trim().max(100).optional(),
    city: z.string().trim().max(100).optional(),
    employeeMin: z.number().int().min(1).max(1_000_000).optional(),
    employeeMax: z.number().int().min(1).max(1_000_000).optional(),
    revenueMin: z.number().min(0).optional(),
    revenueMax: z.number().min(0).optional(),
    jobTitles: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
    keywords: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
    technologies: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
    foundedAfter: z
      .number()
      .int()
      .min(1800)
      .max(new Date().getFullYear())
      .optional(),
    foundedBefore: z
      .number()
      .int()
      .min(1800)
      .max(new Date().getFullYear())
      .optional(),
    fundingStages: z.array(z.string().trim().max(60)).max(20).optional(),
    hasEmail: z.boolean().optional(),
    hasWebsite: z.boolean().optional(),
    isHiring: z.boolean().optional(),
    websiteKeywords: z.array(z.string().trim().max(100)).max(30).optional(),
    linkedinKeywords: z.array(z.string().trim().max(100)).max(30).optional(),
    scoreThreshold: z.number().int().min(0).max(100).optional(),
    interests: z.array(z.string().trim().max(100)).max(30).optional(),
    ageBand: z
      .enum(["18-24", "25-34", "35-44", "45-54", "55-64", "65+"])
      .optional(),
  })
  .strict()
  .superRefine((filters, ctx) => {
    if (
      filters.employeeMin !== undefined &&
      filters.employeeMax !== undefined &&
      filters.employeeMin > filters.employeeMax
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["employeeMin"],
        message: "Minimum employees cannot exceed maximum employees.",
      });
    }
    if (
      filters.revenueMin !== undefined &&
      filters.revenueMax !== undefined &&
      filters.revenueMin > filters.revenueMax
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["revenueMin"],
        message: "Minimum revenue cannot exceed maximum revenue.",
      });
    }
    if (
      filters.foundedAfter !== undefined &&
      filters.foundedBefore !== undefined &&
      filters.foundedAfter > filters.foundedBefore
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["foundedAfter"],
        message: "Founded-after year cannot exceed founded-before year.",
      });
    }
  });

export const createSearchSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    query: z.string().trim().min(3).max(2_000),
    mode: prospectModeSchema.default("B2B"),
    purpose: z.string().trim().min(10).max(1_000).optional(),
    lawfulBasis: lawfulBasisSchema.optional(),
    audienceSource: z
      .enum(["FIRST_PARTY_UPLOAD", "PERMISSIONED_PARTNER"])
      .optional(),
    audienceSourceReference: z.string().trim().min(8).max(500).optional(),
    jurisdiction: z.string().trim().min(2).max(100).optional(),
    legitimateInterestAssessment: z
      .string()
      .trim()
      .min(20)
      .max(2_000)
      .optional(),
    filters: searchFiltersSchema.default({}),
    targetCount: z.number().int().min(1).max(1_000).default(25),
    retentionDays: z.number().int().min(7).max(365).optional(),
    retentionJustification: z.string().trim().min(20).max(1_000).optional(),
    attestations: z
      .object({
        authority: z.literal(true),
        noMinors: z.literal(true),
        noSensitiveTargeting: z.literal(true),
        suppressionCurrent: z.literal(true),
        draftOnly: z.literal(true),
      })
      .strict()
      .optional(),
  })
  .strict();

export const resultsQuerySchema = z.object({
  searchId: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  minScore: z.coerce.number().int().min(0).max(100).default(0),
  industry: z.string().max(100).optional(),
  location: z.string().max(100).optional(),
  title: z.string().max(100).optional(),
  companySize: z.string().max(50).optional(),
  sort: z.enum(["score", "newest", "company", "location"]).default("score"),
});

export const outreachSchema = z
  .object({
    resultId: z.string().min(1),
    type: z.enum([
      "COLD_EMAIL",
      "LINKEDIN_MESSAGE",
      "LINKEDIN_CONNECTION",
      "FOLLOW_UP",
      "WHATSAPP",
    ]),
    tone: z
      .enum(["professional", "friendly", "direct", "premium"])
      .default("professional"),
    offer: z.string().trim().max(500).optional(),
    context: z.string().trim().max(1_000).optional(),
    manualIntent: z.literal(true),
  })
  .strict();

export const exportSchema = z
  .object({
    searchId: z.string().min(1).optional(),
    listId: z.string().min(1).optional(),
    format: z.enum(["CSV", "XLSX", "JSON", "PDF", "CRM", "AI_REPORT"]),
    selectedIds: z.array(z.string().min(1)).max(1_000).optional(),
    minScore: z.number().int().min(0).max(100).optional(),
    onlyVerified: z.boolean().default(false),
    fields: z
      .array(
        z.enum([
          "PROFILE",
          "COMPANY_OR_AUDIENCE",
          "CONTACT",
          "LEAD_DATA",
          "AI_ANALYSIS",
          "PROVENANCE",
        ]),
      )
      .min(1)
      .max(6)
      .optional()
      .refine((values) => !values || new Set(values).size === values.length, {
        message: "Export fields must be unique.",
      }),
    acknowledgeLawfulUse: z.literal(true),
  })
  .strict()
  .refine((value) => Boolean(value.searchId) !== Boolean(value.listId), {
    message: "Provide exactly one searchId or listId.",
    path: ["searchId"],
  });

export const listCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1_000).optional(),
  folderId: z.string().optional(),
  resultIds: z.array(z.string()).max(1_000).default([]),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password: z
    .string()
    .min(12)
    .max(128)
    .regex(/[a-z]/, "Include a lowercase letter.")
    .regex(/[A-Z]/, "Include an uppercase letter.")
    .regex(/[0-9]/, "Include a number."),
  legalAcceptance: z.object({
    termsVersion: z.string().min(1).max(50),
    responsibleUseVersion: z.string().min(1).max(50),
    accepted: z.literal(true),
  }),
});

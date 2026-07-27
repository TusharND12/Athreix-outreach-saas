import { z } from "zod";

const score = z.number().int().min(0).max(100);
const confidence = score;
const evidenceRefs = z.array(z.string().min(1).max(160)).max(12);

export const evidenceClaimSchema = z
  .object({
    claim: z.string().min(3).max(320),
    evidenceRefs,
    confidence,
  })
  .strict();

export const searchUnderstandingSchema = z
  .object({
    mode: z.enum(["B2B", "B2C"]),
    intent: z.string().min(8).max(500),
    targetDescription: z.string().min(8).max(500),
    filters: z
      .object({
        industries: z.array(z.string().min(1).max(100)).max(25),
        locations: z.array(z.string().min(1).max(100)).max(25),
        excludedLocations: z.array(z.string().min(1).max(100)).max(25),
        employeeMin: z.number().int().min(1).max(1_000_000).nullable(),
        employeeMax: z.number().int().min(1).max(1_000_000).nullable(),
        revenueMin: z.number().min(0).nullable(),
        revenueMax: z.number().min(0).nullable(),
        jobTitles: z.array(z.string().min(1).max(100)).max(30),
        technologies: z.array(z.string().min(1).max(100)).max(30),
        keywords: z.array(z.string().min(1).max(100)).max(50),
        fundingStages: z.array(z.string().min(1).max(60)).max(20),
        emailRequirement: z.enum(["ANY", "AVAILABLE"]),
        websiteRequirement: z.enum(["ANY", "PRESENT", "MISSING"]),
        websiteSignals: z.array(z.string().min(1).max(120)).max(20),
        growthSignals: z.array(z.string().min(1).max(120)).max(20),
        isHiring: z.boolean().nullable(),
      })
      .strict(),
    researchPlan: z
      .array(
        z.enum([
          "google_search",
          "google_maps",
          "website",
          "contact",
          "about",
          "services",
          "careers",
          "news",
          "company_profile",
          "reviews",
          "social",
        ]),
      )
      .min(1)
      .max(11),
    assumptions: z.array(z.string().min(3).max(240)).max(10),
    clarificationNeeded: z.boolean(),
    clarificationQuestion: z.string().min(3).max(240).nullable(),
    confidence,
  })
  .strict();

export const companySummarySchema = z
  .object({
    oneLiner: z.string().min(10).max(280),
    businessModel: z.string().min(5).max(500),
    products: z.array(z.string().min(2).max(180)).max(20),
    services: z.array(z.string().min(2).max(180)).max(20),
    targetCustomers: z.array(z.string().min(2).max(180)).max(20),
    strengths: z.array(evidenceClaimSchema).max(12),
    weaknesses: z.array(evidenceClaimSchema).max(12),
    digitalMaturity: score,
    technologyMaturity: score,
    aiReadiness: score,
    overallHealth: score,
    evidenceRefs,
    confidence,
  })
  .strict();

export const buyingIntentSchema = z
  .object({
    intent: z.enum(["LOW", "MEDIUM", "HIGH"]),
    score,
    reasons: z
      .array(
        z
          .object({
            type: z.enum([
              "HIRING",
              "EXPANSION",
              "OFFICE",
              "WEBSITE_CHANGE",
              "TECHNOLOGY_MIGRATION",
              "PRODUCT",
              "AWARD",
              "PARTNERSHIP",
              "NEWS",
              "COMMUNITY",
              "OTHER",
            ]),
            title: z.string().min(3).max(180),
            explanation: z.string().min(8).max(500),
            strength: z.enum(["WEAK", "MODERATE", "STRONG"]),
            observedAt: z.string().datetime().nullable(),
            evidenceRefs,
            confidence,
          })
          .strict(),
      )
      .max(20),
    recommendedTiming: z.string().min(3).max(240),
    confidence,
  })
  .strict();

export const painPointSchema = z
  .object({
    issues: z
      .array(
        z
          .object({
            category: z.enum([
              "DESIGN",
              "BRANDING",
              "SEO",
              "CHAT",
              "AUTOMATION",
              "FORMS",
              "CRM",
              "MOBILE",
              "ACCESSIBILITY",
              "TECHNOLOGY",
              "PERFORMANCE",
              "CONTENT",
              "SECURITY",
              "OTHER",
            ]),
            title: z.string().min(3).max(180),
            problem: z.string().min(8).max(500),
            businessImpact: z.string().min(8).max(500),
            severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
            evidenceRefs,
            confidence,
          })
          .strict(),
      )
      .max(30),
    confidence,
  })
  .strict();

export const websiteAuditSchema = z
  .object({
    overallScore: score,
    scores: z
      .object({
        userExperience: score,
        userInterface: score,
        branding: score,
        performance: score,
        accessibility: score,
        seo: score,
        content: score,
        responsiveness: score,
        callsToAction: score,
        trustSignals: score,
        forms: score,
        security: score,
      })
      .strict(),
    analyzedPages: z.array(z.string().url()).max(50),
    issues: z.array(evidenceClaimSchema).max(30),
    recommendations: z.array(evidenceClaimSchema).max(30),
    businessOpportunities: z.array(evidenceClaimSchema).max(20),
    missingFeatures: z.array(z.string().min(2).max(180)).max(30),
    evidenceRefs,
    confidence,
  })
  .strict();

export const technologyDetectionSchema = z
  .object({
    technologies: z
      .array(
        z
          .object({
            name: z.string().min(1).max(120),
            category: z.enum([
              "FRAMEWORK",
              "CMS",
              "HOSTING",
              "ANALYTICS",
              "ADVERTISING",
              "PAYMENT",
              "BACKEND",
              "CLOUD",
              "CDN",
              "JAVASCRIPT",
              "LIBRARY",
              "TRACKING",
              "CRM",
              "AUTOMATION",
              "OTHER",
            ]),
            version: z.string().max(80).nullable(),
            evidenceRefs,
            confidence,
          })
          .strict(),
      )
      .max(80),
    maturityScore: score,
    modernizationOpportunities: z.array(evidenceClaimSchema).max(20),
    confidence,
  })
  .strict();

export const leadQualificationSchema = z
  .object({
    score,
    buyingIntent: z.enum(["LOW", "MEDIUM", "HIGH"]),
    summary: z.string().min(20).max(800),
    reasons: z.array(z.string().min(3).max(240)).min(3).max(8),
    suggestedOffer: z.string().min(10).max(500),
    decisionMakerConfidence: score,
    recommendedChannel: z.enum([
      "EMAIL",
      "LINKEDIN",
      "PHONE",
      "WHATSAPP",
      "REVIEW_REQUIRED",
    ]),
    scoreBreakdown: z
      .object({
        websiteQuality: score,
        technology: score,
        businessGrowth: score,
        buyingIntent: score,
        digitalMaturity: score,
        decisionMakers: score,
        evidenceConfidence: score,
      })
      .strict(),
    painPoints: z.array(evidenceClaimSchema).max(12),
    buyingSignals: z.array(evidenceClaimSchema).max(12),
    recommendedServices: z.array(z.string().min(3).max(180)).max(12),
    confidence,
  })
  .strict();

export const salesStrategySchema = z
  .object({
    whyValuable: z.string().min(10).max(600),
    bestApproach: z.string().min(10).max(600),
    channelPlan: z
      .array(
        z
          .object({
            channel: z.enum([
              "EMAIL",
              "LINKEDIN",
              "PHONE",
              "WEBSITE_PROPOSAL",
              "AI_PROPOSAL",
              "CRM_PROPOSAL",
              "AUTOMATION_PROPOSAL",
            ]),
            angle: z.string().min(8).max(400),
            priority: z.number().int().min(1).max(7),
            evidenceRefs,
          })
          .strict(),
      )
      .max(7),
    recommendedServices: z.array(z.string().min(3).max(180)).max(12),
    whyItWillWork: z.string().min(10).max(600),
    risks: z.array(z.string().min(3).max(240)).max(10),
    evidenceRefs,
    confidence,
  })
  .strict();

const outreachMessageSchema = z
  .object({
    subject: z.string().max(120).nullable(),
    body: z.string().min(20).max(4_000),
    evidenceRefs,
  })
  .strict();

export const outreachSchema = z
  .object({
    coldEmail: outreachMessageSchema,
    linkedinMessage: outreachMessageSchema,
    followUpEmail: outreachMessageSchema,
    meetingInvitation: outreachMessageSchema,
    websiteAudit: outreachMessageSchema,
    proposal: outreachMessageSchema,
    confidence,
  })
  .strict();

export const executiveSummarySchema = z
  .object({
    headline: z.string().min(5).max(180),
    summary: z.string().min(30).max(1_200),
    keyFindings: z.array(evidenceClaimSchema).max(12),
    opportunities: z.array(evidenceClaimSchema).max(12),
    risks: z.array(evidenceClaimSchema).max(12),
    nextBestAction: z.string().min(8).max(500),
    evidenceRefs,
    confidence,
  })
  .strict();

export const competitorAnalysisSchema = z
  .object({
    competitors: z
      .array(
        z
          .object({
            name: z.string().min(1).max(180),
            positioning: z.string().min(5).max(500),
            strengths: z.array(z.string().min(2).max(180)).max(12),
            weaknesses: z.array(z.string().min(2).max(180)).max(12),
            evidenceRefs,
            confidence,
          })
          .strict(),
      )
      .max(20),
    differentiationOpportunities: z.array(evidenceClaimSchema).max(20),
    confidence,
  })
  .strict();

export const industryAnalysisSchema = z
  .object({
    overview: z.string().min(20).max(1_000),
    growth: z.string().min(8).max(500),
    competition: z.string().min(8).max(500),
    technologyAdoption: z.string().min(8).max(500),
    digitalMaturity: score,
    buyingTrends: z.array(evidenceClaimSchema).max(15),
    salesOpportunities: z.array(evidenceClaimSchema).max(15),
    evidenceRefs,
    confidence,
  })
  .strict();

export const companyChatAnswerSchema = z
  .object({
    answer: z.string().min(10).max(2_500),
    evidenceRefs,
    confidence,
    followUpQuestions: z.array(z.string().min(3).max(180)).max(4),
  })
  .strict();

export const intelligenceSchemas = {
  searchUnderstanding: searchUnderstandingSchema,
  companySummary: companySummarySchema,
  buyingIntent: buyingIntentSchema,
  painPoints: painPointSchema,
  websiteAudit: websiteAuditSchema,
  technologyDetection: technologyDetectionSchema,
  leadQualification: leadQualificationSchema,
  salesStrategy: salesStrategySchema,
  outreach: outreachSchema,
  executiveSummary: executiveSummarySchema,
  competitorAnalysis: competitorAnalysisSchema,
  industryAnalysis: industryAnalysisSchema,
  companyChat: companyChatAnswerSchema,
} as const;

export type IntelligenceTaskName = keyof typeof intelligenceSchemas;
export type SearchUnderstanding = z.infer<typeof searchUnderstandingSchema>;

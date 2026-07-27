import { db } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import { AppError } from "@/lib/server/errors";
import { buildDemoCompanyIntelligence } from "@/lib/intelligence/demo";
import type {
  CompanyIntelligence,
  EvidenceItem,
} from "@/lib/intelligence/types";
import type { RequestContext } from "@/server/auth-context";
import { demoState, type PublicProspect } from "@/server/demo-store";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function records(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

function strings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function claimStrings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string") return [item];
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const entry = item as Record<string, unknown>;
    const value =
      typeof entry.claim === "string"
        ? entry.claim
        : typeof entry.title === "string"
          ? entry.title
          : "";
    return value ? [value] : [];
  });
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function number(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function severity(value: unknown): "low" | "medium" | "high" | "critical" {
  const normalized = text(value, "medium").toLowerCase();
  return ["low", "medium", "high", "critical"].includes(normalized)
    ? (normalized as "low" | "medium" | "high" | "critical")
    : "medium";
}

function evidenceFromDatabase(
  rows: Array<{
    id: string;
    field: string;
    excerpt: string | null;
    provider: string;
    sourceUrl: string | null;
    observedAt: Date;
    confidence: number | null;
  }>,
): EvidenceItem[] {
  return rows.map((item) => ({
    id: item.id,
    label: item.field.replaceAll(".", " ").replaceAll("_", " "),
    excerpt: item.excerpt ?? `Verified ${item.field.replaceAll("_", " ")}`,
    source: item.provider,
    sourceUrl: item.sourceUrl ?? undefined,
    observedAt: item.observedAt.toISOString(),
    confidence: item.confidence ?? 50,
    reference: item.id,
  }));
}

function liveLocalCompanyIntelligence(
  result: PublicProspect,
): CompanyIntelligence {
  if (result.mode !== "B2B" || result.normalized.mode !== "B2B") {
    throw new AppError("NOT_FOUND", "Company not found.", 404);
  }
  const normalized = result.normalized;
  const company = normalized.company;
  const contact = normalized.contact;
  const evidence: EvidenceItem[] = result.evidence.map((item, index) => ({
    id: `${result.id}-evidence-${index + 1}`,
    label: item.field.replaceAll("_", " "),
    excerpt: result.summary,
    source: item.provider,
    sourceUrl: item.sourceUrl,
    observedAt: item.observedAt,
    confidence: item.confidence,
    reference: `${result.id}-evidence-${index + 1}`,
  }));
  const evidenceRefs = evidence.map((item) => item.id);
  const websiteScore = company.websiteQuality ?? 0;
  const intentScore =
    result.buyingIntent === "HIGH"
      ? 90
      : result.buyingIntent === "MEDIUM"
        ? 68
        : 40;
  const researchSignals = normalized.research?.signals ?? [];
  const observedPages = Array.from(
    new Set(
      [
        normalized.sourceUrl,
        ...(normalized.research?.evidence.flatMap((item) =>
          item.sourceUrl ? [item.sourceUrl] : [],
        ) ?? []),
      ].filter((item): item is string => Boolean(item)),
    ),
  );
  return {
    id: result.id,
    name: company.name,
    domain: company.domain,
    website: company.website,
    location: company.location,
    industry: company.industry,
    categories: [company.industry, ...company.keywords].filter(
      (item): item is string => Boolean(item),
    ),
    employeeRange: company.employeeRange,
    foundedYear: company.foundedYear,
    description: company.description ?? result.summary,
    lastResearchedAt: result.createdAt,
    researchStatus: researchSignals.length ? "ready" : "partial",
    scores: {
      overall: result.score,
      website: websiteScore,
      seo: 0,
      accessibility: 0,
      performance: 0,
      branding: 0,
      technology: number(result.scoreBreakdown.technology, 0),
      businessGrowth: number(result.scoreBreakdown.businessGrowth, 0),
      buyingIntent: intentScore,
      digitalMaturity: websiteScore,
      decisionMakers: result.decisionMakerConfidence,
      confidence: result.decisionMakerConfidence,
    },
    summary: {
      oneLiner: result.summary,
      businessModel: "Not established from the retained Apify evidence.",
      products: [],
      services: [],
      targetCustomers: [],
      strengths: result.reasons,
      weaknesses: [],
      technologyMaturity: number(result.scoreBreakdown.technology, 0),
      aiReadiness: 0,
      overallHealth: result.score,
    },
    websiteAnalysis: {
      analyzedPages: observedPages,
      scores: {
        website: websiteScore,
        seo: 0,
        accessibility: 0,
        performance: 0,
        branding: 0,
        ux: 0,
        ui: 0,
        content: 0,
        responsiveness: 0,
        callsToAction: 0,
        trustSignals: 0,
        forms: 0,
        security: 0,
      },
      issues: [],
      recommendations: [],
      opportunities: [],
      missingFeatures: [],
    },
    technologies: company.technologies.map((name) => ({
      name,
      category: "Observed",
      confidence: 80,
      evidenceRefs,
    })),
    contacts: {
      email: contact.email,
      phone: contact.phone,
      address: company.location,
      socialLinks: [
        ...(contact.linkedinUrl
          ? [{ label: "LinkedIn", url: contact.linkedinUrl }]
          : []),
        ...(company.website
          ? [{ label: "Website", url: company.website }]
          : []),
      ],
    },
    reviews: { themes: [], confidence: 0 },
    buyingSignals: researchSignals.map((signal) => ({
      id: signal.evidenceRefs[0] ?? `${result.id}-${signal.type}`,
      type: signal.type,
      title: signal.title,
      detail: signal.detail,
      strength: signal.strength.toLowerCase() as "weak" | "moderate" | "strong",
      observedAt: signal.observedAt,
      confidence: signal.confidence,
      evidenceRefs: signal.evidenceRefs,
    })),
    painPoints: [],
    decisionMakers: [
      {
        id: result.id,
        name: contact.fullName,
        role: contact.title ?? "Public professional role",
        publicProfile: contact.linkedinUrl,
        email: contact.email,
        confidence: result.decisionMakerConfidence,
        reasonToContact: result.reasons[0] ?? result.summary,
        evidenceRefs,
      },
    ],
    salesStrategy: {
      whyValuable: result.summary,
      bestApproach:
        result.reasons[0] ?? "Review the retained evidence before outreach.",
      recommendedServices: [],
      channelPlan:
        result.recommendedChannel === "REVIEW_REQUIRED"
          ? []
          : [
              {
                channel: result.recommendedChannel,
                angle: result.suggestedOffer,
                priority: 1,
                evidenceRefs,
              },
            ],
      whyItWillWork: result.suggestedOffer,
      risks: ["Validate every retained claim before contacting the prospect."],
    },
    recommendations: [],
    timeline: researchSignals.map((signal) => ({
      id: signal.evidenceRefs[0] ?? `${result.id}-${signal.type}`,
      type: signal.type,
      title: signal.title,
      detail: signal.detail,
      occurredAt: signal.observedAt,
      confidence: signal.confidence,
      evidenceRefs: signal.evidenceRefs,
    })),
    outreach: {
      coldEmail: { subject: "", body: "" },
      linkedinMessage: "",
      followUpEmail: { subject: "", body: "" },
      meetingInvitation: "",
      websiteAudit: "",
      proposal: "",
    },
    evidence,
    industryInsights: {
      overview: company.description ?? "Not enough retained evidence.",
      growth: "Not enough retained evidence.",
      competition: "Not enough retained evidence.",
      technologyAdoption: company.technologies.join(", "),
      digitalMaturity: websiteScore,
      buyingTrends: [],
      salesOpportunities: [],
    },
  };
}

export async function getCompanyIntelligence(
  context: RequestContext,
  id: string,
): Promise<CompanyIntelligence> {
  if (context.demo) {
    if (env.mockDataEnabled) return buildDemoCompanyIntelligence(id);
    const result = demoState.results.find(
      (item) =>
        item.mode === "B2B" &&
        item.normalized.mode === "B2B" &&
        (item.id === id ||
          item.normalized.company.domain === id ||
          item.normalized.company.normalizedName === id),
    );
    if (!result) throw new AppError("NOT_FOUND", "Company not found.", 404);
    return liveLocalCompanyIntelligence(result);
  }
  const now = new Date();
  const company = await db.company.findFirst({
    where: {
      workspaceId: context.workspaceId,
      OR: [{ id }, { domain: id }, { normalizedDomain: id }],
    },
    include: {
      research: true,
      websiteAnalysis: true,
      buyingSignals: { orderBy: { observedAt: "desc" }, take: 30 },
      timelineEvents: { orderBy: { occurredAt: "desc" }, take: 50 },
      evidence: {
        where: { expiresAt: { gt: now } },
        orderBy: { observedAt: "desc" },
        take: 100,
      },
      contacts: {
        where: { retentionUntil: { gt: now } },
        orderBy: { decisionMakerConfidence: "desc" },
        take: 20,
      },
      results: {
        where: { retentionUntil: { gt: now } },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          aiResponses: { orderBy: { createdAt: "desc" }, take: 1 },
          outreach: { orderBy: { createdAt: "desc" }, take: 20 },
        },
      },
    },
  });
  if (!company) throw new AppError("NOT_FOUND", "Company not found.", 404);
  const latest = company.results[0];
  const ai = record(latest?.aiResponses[0]?.output);
  const summary = record(company.research?.summary);
  const salesStrategy = record(company.research?.salesStrategy);
  const buyingIntentAnalysis = record(company.research?.buyingIntent);
  const painPointAnalysis = record(company.research?.painPoints);
  const technologyAnalysis = record(company.research?.technologyDetection);
  const generatedOutreach = record(company.research?.outreach);
  const industryInsights = record(company.research?.industryInsights);
  const competitorAnalysis = record(company.research?.competitorAnalysis);
  const website = company.websiteAnalysis;
  const websiteIssues = records(website?.issues);
  const websiteRecommendations = records(website?.recommendations);
  const evidence = evidenceFromDatabase(company.evidence);
  const fallbackEvidenceRefs = evidence.slice(0, 5).map((item) => item.id);
  const scoreBreakdown = record(latest?.scoreBreakdown);
  const aiBreakdown = record(ai.scoreBreakdown);
  const outreachByType = new Map(
    (latest?.outreach ?? []).map((draft) => [draft.type, draft]),
  );
  const coldEmail = outreachByType.get("COLD_EMAIL");
  const followUp = outreachByType.get("FOLLOW_UP");
  const linkedin = outreachByType.get("LINKEDIN_MESSAGE");
  const meeting = outreachByType.get("MEETING_INVITATION");
  const audit = outreachByType.get("WEBSITE_AUDIT");
  const proposal = outreachByType.get("PROPOSAL");
  const generatedColdEmail = record(generatedOutreach.coldEmail);
  const generatedLinkedin = record(generatedOutreach.linkedinMessage);
  const generatedFollowUp = record(generatedOutreach.followUpEmail);
  const generatedMeeting = record(generatedOutreach.meetingInvitation);
  const generatedAudit = record(generatedOutreach.websiteAudit);
  const generatedProposal = record(generatedOutreach.proposal);
  const detectedTechnologies = records(technologyAnalysis.technologies);
  const structuredPainPoints = records(painPointAnalysis.issues);
  const competitors = records(competitorAnalysis.competitors);
  const baseWebsiteScore =
    website?.overallScore ?? company.websiteQuality ?? 50;
  const overall = latest?.score ?? number(summary.overallHealth, 50);

  return {
    id: company.id,
    name: company.name,
    domain: company.domain ?? undefined,
    website: company.website ?? undefined,
    logoUrl: company.logoUrl ?? undefined,
    screenshotUrl: website?.screenshotUrl ?? company.screenshotUrl ?? undefined,
    location: company.location ?? undefined,
    industry: company.industry ?? undefined,
    categories: company.categories.length
      ? company.categories
      : [company.industry].filter((value): value is string => Boolean(value)),
    employeeRange: company.employeeRange ?? undefined,
    foundedYear: company.foundedYear ?? undefined,
    description:
      company.description ??
      text(
        summary.oneLiner,
        `${company.name} requires a refreshed research summary.`,
      ),
    lastResearchedAt: (
      company.research?.researchedAt ??
      company.lastVerifiedAt ??
      company.updatedAt
    ).toISOString(),
    researchStatus:
      company.research?.status === "READY"
        ? "ready"
        : company.research
          ? "researching"
          : "partial",
    scores: {
      overall,
      website: baseWebsiteScore,
      seo: website?.seo ?? baseWebsiteScore,
      accessibility: website?.accessibility ?? baseWebsiteScore,
      performance: website?.performance ?? baseWebsiteScore,
      branding: website?.branding ?? baseWebsiteScore,
      technology: number(
        aiBreakdown.technology,
        number(scoreBreakdown.technology, 50),
      ),
      businessGrowth: number(
        aiBreakdown.businessGrowth,
        company.isHiring ? 80 : 50,
      ),
      buyingIntent: number(
        buyingIntentAnalysis.score,
        number(aiBreakdown.buyingIntent, overall),
      ),
      digitalMaturity: number(aiBreakdown.digitalMaturity, baseWebsiteScore),
      decisionMakers: number(
        aiBreakdown.decisionMakers,
        company.contacts[0]?.decisionMakerConfidence ?? 50,
      ),
      confidence:
        latest?.confidence ??
        company.research?.confidence ??
        number(ai.confidence, 50),
    },
    summary: {
      oneLiner: text(
        summary.oneLiner,
        company.description ?? `${company.name} business profile`,
      ),
      businessModel: text(summary.businessModel, "Requires evidence review"),
      products: strings(summary.products),
      services: strings(summary.services),
      targetCustomers: strings(summary.targetCustomers),
      strengths: claimStrings(summary.strengths),
      weaknesses: claimStrings(summary.weaknesses),
      technologyMaturity: number(summary.technologyMaturity, 50),
      aiReadiness: number(summary.aiReadiness, 50),
      overallHealth: number(summary.overallHealth, overall),
    },
    websiteAnalysis: {
      analyzedPages: website?.analyzedPages ?? [],
      scores: {
        website: baseWebsiteScore,
        seo: website?.seo ?? baseWebsiteScore,
        accessibility: website?.accessibility ?? baseWebsiteScore,
        performance: website?.performance ?? baseWebsiteScore,
        branding: website?.branding ?? baseWebsiteScore,
        ux: website?.userExperience ?? baseWebsiteScore,
        ui: website?.userInterface ?? baseWebsiteScore,
        content: website?.content ?? baseWebsiteScore,
        responsiveness: website?.responsiveness ?? baseWebsiteScore,
        callsToAction: website?.callsToAction ?? baseWebsiteScore,
        trustSignals: website?.trustSignals ?? baseWebsiteScore,
        forms: website?.forms ?? baseWebsiteScore,
        security: website?.security ?? baseWebsiteScore,
      },
      issues: websiteIssues.map((item) => ({
        title: text(item.title, text(item.claim, "Website finding")),
        severity: severity(item.severity),
        businessImpact: text(
          item.businessImpact,
          "Review the cited evidence before prioritizing this finding.",
        ),
        evidenceRefs: strings(item.evidenceRefs),
        confidence: number(item.confidence, 50),
      })),
      recommendations: websiteRecommendations.map((item) => ({
        title: text(item.title, text(item.claim, "Recommendation")),
        outcome: text(
          item.outcome,
          "Validate the opportunity against current business priorities.",
        ),
        evidenceRefs: strings(item.evidenceRefs),
      })),
      opportunities: records(website?.businessOpportunities).map((item) =>
        text(item.title, text(item.claim, "Business opportunity")),
      ),
      missingFeatures: website?.missingFeatures ?? [],
    },
    technologies: detectedTechnologies.length
      ? detectedTechnologies.map((technology) => ({
          name: text(technology.name, "Unknown technology"),
          category: text(technology.category, "Detected"),
          version: text(technology.version) || undefined,
          confidence: number(technology.confidence, 50),
          evidenceRefs: strings(technology.evidenceRefs),
        }))
      : company.technologies.map((name) => ({
          name,
          category: "Detected",
          confidence: 80,
          evidenceRefs: fallbackEvidenceRefs,
        })),
    contacts: {
      email: company.contacts[0]?.emailMasked ?? undefined,
      phone: company.contacts[0]?.phoneMasked ?? undefined,
      address: company.location ?? undefined,
      socialLinks: [
        ...(company.linkedinUrl
          ? [{ label: "LinkedIn", url: company.linkedinUrl }]
          : []),
        ...(company.website
          ? [{ label: "Website", url: company.website }]
          : []),
      ],
    },
    reviews: { themes: [], confidence: 0 },
    buyingSignals: company.buyingSignals.map((signal) => ({
      id: signal.id,
      type: signal.type,
      title: signal.title,
      detail: signal.detail,
      strength: ["weak", "moderate", "strong"].includes(
        signal.strength.toLowerCase(),
      )
        ? (signal.strength.toLowerCase() as "weak" | "moderate" | "strong")
        : "moderate",
      observedAt: signal.observedAt.toISOString(),
      confidence: signal.confidence,
      evidenceRefs: signal.evidenceRefs,
    })),
    painPoints: (structuredPainPoints.length
      ? structuredPainPoints
      : records(ai.painPoints)
    ).map((point, index) => ({
      id: `pain-${index + 1}`,
      category: text(point.category, "Business"),
      title: text(point.title, text(point.claim, "Evidence-backed issue")),
      problem: text(point.problem, text(point.claim)),
      businessImpact: text(
        point.businessImpact,
        "Validate the impact with the account before proposing work.",
      ),
      severity: severity(point.severity),
      confidence: number(point.confidence, 50),
      evidenceRefs: strings(point.evidenceRefs),
    })),
    decisionMakers: company.contacts.map((contact) => ({
      id: contact.id,
      name: contact.fullName,
      role: contact.title ?? "Role not verified",
      publicProfile: contact.linkedinUrl ?? undefined,
      email: contact.emailMasked ?? undefined,
      confidence: contact.decisionMakerConfidence ?? 50,
      reasonToContact:
        "This public professional role is connected to the retained company opportunity.",
      evidenceRefs: fallbackEvidenceRefs,
    })),
    salesStrategy: {
      whyValuable: text(salesStrategy.whyValuable, latest?.summary ?? ""),
      bestApproach: text(
        salesStrategy.bestApproach,
        latest?.reasons[0] ?? "Lead with verified evidence.",
      ),
      recommendedServices: strings(
        salesStrategy.recommendedServices ?? ai.recommendedServices,
      ),
      channelPlan: records(salesStrategy.channelPlan).map((item) => ({
        channel: text(item.channel, "Email"),
        angle: text(item.angle, "Lead with a verified company signal."),
        priority: number(item.priority, 1),
        evidenceRefs: strings(item.evidenceRefs),
      })),
      whyItWillWork: text(
        salesStrategy.whyItWillWork,
        latest?.suggestedOffer ?? "",
      ),
      risks: strings(salesStrategy.risks),
    },
    recommendations: websiteRecommendations.map((item) => ({
      title: text(item.title, text(item.claim, "Recommendation")),
      detail: text(
        item.outcome,
        "Review this recommendation against current company priorities.",
      ),
      impact: "medium" as const,
      evidenceRefs: strings(item.evidenceRefs),
    })),
    timeline: company.timelineEvents.map((event) => ({
      id: event.id,
      type: event.type,
      title: event.title,
      detail: event.detail ?? "",
      occurredAt: event.occurredAt.toISOString(),
      confidence: event.confidence ?? 50,
      evidenceRefs: event.evidenceRefs,
    })),
    outreach: {
      coldEmail: {
        subject:
          coldEmail?.subject ??
          text(
            generatedColdEmail.subject,
            `A focused idea for ${company.name}`,
          ),
        body:
          coldEmail?.body ??
          text(
            generatedColdEmail.body,
            "Generate an evidence-backed email after reviewing the company dossier.",
          ),
      },
      linkedinMessage:
        linkedin?.body ??
        text(
          generatedLinkedin.body,
          "Generate an evidence-backed LinkedIn message after reviewing the company dossier.",
        ),
      followUpEmail: {
        subject:
          followUp?.subject ??
          text(generatedFollowUp.subject, `Following up on ${company.name}`),
        body:
          followUp?.body ??
          text(
            generatedFollowUp.body,
            "Generate an evidence-backed follow-up after reviewing the dossier.",
          ),
      },
      meetingInvitation:
        meeting?.body ??
        text(
          generatedMeeting.body,
          "Review the evidence and agree a focused next step.",
        ),
      websiteAudit:
        audit?.body ??
        text(
          generatedAudit.body,
          "Generate a website audit from the retained website evidence.",
        ),
      proposal:
        proposal?.body ??
        text(
          generatedProposal.body,
          "Generate a proposal only after validating the retained evidence.",
        ),
    },
    evidence,
    industryInsights: {
      overview: text(
        industryInsights.overview,
        `${company.industry ?? "This industry"} requires additional retained evidence for a detailed overview.`,
      ),
      growth: text(industryInsights.growth, "Not enough evidence"),
      competition: text(
        industryInsights.competition,
        competitors.length
          ? competitors
              .map(
                (competitor) =>
                  `${text(competitor.name, "Competitor")}: ${text(
                    competitor.positioning,
                    "positioning requires review",
                  )}`,
              )
              .join(" ")
          : "Not enough evidence",
      ),
      technologyAdoption: text(
        industryInsights.technologyAdoption,
        "Not enough evidence",
      ),
      digitalMaturity: number(
        industryInsights.digitalMaturity,
        baseWebsiteScore,
      ),
      buyingTrends: claimStrings(industryInsights.buyingTrends),
      salesOpportunities: [
        ...claimStrings(industryInsights.salesOpportunities),
        ...claimStrings(competitorAnalysis.differentiationOpportunities),
      ],
    },
  };
}

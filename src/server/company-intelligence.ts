import type { Prisma } from "@prisma/client";
import { db } from "@/lib/server/db";
import { hashIdentifier } from "@/lib/server/crypto";
import type { ProspectAnalysis } from "@/server/ai";
import type { NormalizedB2BProspect } from "@/server/normalize";
import type { ScoreResult } from "@/server/scoring";
import { researchCompanyIntelligence } from "@/server/intelligence/company-research";

function boundedScore(value: number | undefined, fallback: number) {
  return Math.max(0, Math.min(100, Math.round(value ?? fallback)));
}

function websiteScores(
  item: NormalizedB2BProspect,
  analysis: ProspectAnalysis,
) {
  const base = boundedScore(
    item.company.websiteQuality,
    analysis.scoreBreakdown.websiteQuality,
  );
  return {
    overallScore: base,
    userExperience: boundedScore(base - 2, base),
    userInterface: boundedScore(base - 1, base),
    branding: boundedScore(base - 5, base),
    performance: boundedScore(base - 8, base),
    accessibility: boundedScore(base - 10, base),
    seo: boundedScore(base - 7, base),
    content: boundedScore(base - 3, base),
    responsiveness: boundedScore(base - 4, base),
    callsToAction: boundedScore(base - 9, base),
    trustSignals: boundedScore(base - 2, base),
    forms: boundedScore(base - 8, base),
    security: boundedScore(base + 3, base),
  };
}

export async function persistCompanyIntelligence(input: {
  workspaceId: string;
  companyId: string;
  searchResultId: string;
  item: NormalizedB2BProspect;
  deterministic: ScoreResult;
  analysis: ProspectAnalysis;
  query: string;
  purpose: string;
  userId: string;
  deadlineAt?: number;
}) {
  const { item, analysis } = input;
  const intelligence = await researchCompanyIntelligence({
    item,
    analysis,
    query: input.query,
    purpose: input.purpose,
    workspaceId: input.workspaceId,
    userId: input.userId,
    deadlineAt: input.deadlineAt,
  });
  const observedAt = new Date(item.provenance.collectedAt);
  const evidenceRefs = (item.research?.evidence ?? [])
    .map((evidence) => evidence.id)
    .slice(0, 50);
  const structuredWebsite = intelligence?.websiteAudit;
  const scores = structuredWebsite
    ? {
        overallScore: structuredWebsite.overallScore,
        ...structuredWebsite.scores,
      }
    : websiteScores(item, analysis);
  const summary =
    intelligence?.companySummary ??
    ({
      oneLiner:
        item.company.description ??
        `${item.company.name} is a ${item.company.industry ?? "business"} organization in ${item.company.location ?? "its reported market"}.`,
      businessModel: item.company.description ?? "Requires evidence review",
      products: item.company.keywords.slice(0, 8),
      services: analysis.recommendedServices,
      targetCustomers: [],
      strengths: analysis.reasons.slice(0, 4),
      weaknesses: analysis.painPoints,
      digitalMaturity: analysis.scoreBreakdown.digitalMaturity,
      technologyMaturity: analysis.scoreBreakdown.technology,
      aiReadiness: Math.round(
        (analysis.scoreBreakdown.technology +
          analysis.scoreBreakdown.digitalMaturity) /
          2,
      ),
      overallHealth: analysis.score,
      evidenceRefs,
      confidence: analysis.confidence,
    } as const);
  const salesStrategy =
    intelligence?.salesStrategy ??
    ({
      whyValuable: analysis.summary,
      bestApproach:
        analysis.reasons[0] ??
        "Lead with a verified business signal and a narrow, useful observation.",
      channelPlan: [],
      recommendedServices: analysis.recommendedServices,
      whyItWillWork: analysis.suggestedOffer,
      risks: [],
      evidenceRefs,
      confidence: analysis.confidence,
    } as const);
  const issueRows =
    intelligence?.painPoints?.issues ??
    structuredWebsite?.issues ??
    analysis.painPoints.map((point) => ({
      claim: point.claim,
      evidenceRefs: point.evidenceRefs,
      confidence: point.confidence,
    }));
  const recommendations =
    structuredWebsite?.recommendations ??
    analysis.recommendedServices.map((service) => ({
      claim: service,
      evidenceRefs,
      confidence: analysis.confidence,
    }));
  const businessOpportunities =
    structuredWebsite?.businessOpportunities ?? recommendations;
  const researchSignals = item.research?.signals ?? [];
  const inferredSignals = analysis.buyingSignals.map((signal) => ({
    type: "AI_QUALIFICATION",
    title: signal.claim.slice(0, 180),
    detail: signal.claim,
    strength: signal.confidence >= 85 ? "STRONG" : "MODERATE",
    confidence: signal.confidence,
    sourceUrl: undefined,
    evidenceRefs: signal.evidenceRefs,
    observedAt,
  }));
  const structuredSignals = (intelligence?.buyingIntent?.reasons ?? []).map(
    (signal) => ({
      type: signal.type,
      title: signal.title,
      detail: signal.explanation,
      strength: signal.strength,
      confidence: signal.confidence,
      sourceUrl: item.research?.evidence.find((evidence) =>
        signal.evidenceRefs.includes(evidence.id),
      )?.sourceUrl,
      evidenceRefs: signal.evidenceRefs,
      observedAt: signal.observedAt ? new Date(signal.observedAt) : observedAt,
    }),
  );
  const signals = [
    ...researchSignals.map((signal) => ({
      type: signal.type,
      title: signal.title,
      detail: signal.detail,
      strength: signal.strength,
      confidence: signal.confidence,
      sourceUrl: item.research?.evidence.find((evidence) =>
        signal.evidenceRefs.includes(evidence.id),
      )?.sourceUrl,
      evidenceRefs: signal.evidenceRefs,
      observedAt: new Date(signal.observedAt),
    })),
    ...structuredSignals,
    ...inferredSignals,
  ];

  await db.$transaction(async (tx) => {
    await tx.companyResearch.upsert({
      where: { companyId: input.companyId },
      create: {
        workspaceId: input.workspaceId,
        companyId: input.companyId,
        summary: summary as Prisma.InputJsonValue,
        salesStrategy: salesStrategy as Prisma.InputJsonValue,
        executiveSummary:
          (intelligence?.executiveSummary as Prisma.InputJsonValue) ?? {
            headline: `${item.company.name}: ${analysis.buyingIntent.toLowerCase()} buying intent`,
            summary: analysis.summary,
            keyFindings: analysis.reasons,
            nextBestAction: analysis.suggestedOffer,
            evidenceRefs,
          },
        ...(intelligence?.buyingIntent
          ? {
              buyingIntent: intelligence.buyingIntent as Prisma.InputJsonValue,
            }
          : {}),
        ...(intelligence?.painPoints
          ? { painPoints: intelligence.painPoints as Prisma.InputJsonValue }
          : {}),
        ...(intelligence?.technologyDetection
          ? {
              technologyDetection:
                intelligence.technologyDetection as Prisma.InputJsonValue,
            }
          : {}),
        ...(intelligence?.outreach
          ? { outreach: intelligence.outreach as Prisma.InputJsonValue }
          : {}),
        ...(intelligence?.industryAnalysis
          ? {
              industryInsights:
                intelligence.industryAnalysis as Prisma.InputJsonValue,
            }
          : {}),
        ...(intelligence?.competitorAnalysis
          ? {
              competitorAnalysis:
                intelligence.competitorAnalysis as Prisma.InputJsonValue,
            }
          : {}),
        model: intelligence?.model ?? analysis.model,
        promptVersion: intelligence?.promptVersion ?? analysis.promptVersion,
        confidence:
          intelligence?.executiveSummary?.confidence ?? analysis.confidence,
        researchedAt: observedAt,
      },
      update: {
        summary: summary as Prisma.InputJsonValue,
        salesStrategy: salesStrategy as Prisma.InputJsonValue,
        executiveSummary:
          (intelligence?.executiveSummary as Prisma.InputJsonValue) ?? {
            headline: `${item.company.name}: ${analysis.buyingIntent.toLowerCase()} buying intent`,
            summary: analysis.summary,
            keyFindings: analysis.reasons,
            nextBestAction: analysis.suggestedOffer,
            evidenceRefs,
          },
        ...(intelligence?.buyingIntent
          ? {
              buyingIntent: intelligence.buyingIntent as Prisma.InputJsonValue,
            }
          : {}),
        ...(intelligence?.painPoints
          ? { painPoints: intelligence.painPoints as Prisma.InputJsonValue }
          : {}),
        ...(intelligence?.technologyDetection
          ? {
              technologyDetection:
                intelligence.technologyDetection as Prisma.InputJsonValue,
            }
          : {}),
        ...(intelligence?.outreach
          ? { outreach: intelligence.outreach as Prisma.InputJsonValue }
          : {}),
        ...(intelligence?.industryAnalysis
          ? {
              industryInsights:
                intelligence.industryAnalysis as Prisma.InputJsonValue,
            }
          : {}),
        ...(intelligence?.competitorAnalysis
          ? {
              competitorAnalysis:
                intelligence.competitorAnalysis as Prisma.InputJsonValue,
            }
          : {}),
        model: intelligence?.model ?? analysis.model,
        promptVersion: intelligence?.promptVersion ?? analysis.promptVersion,
        confidence:
          intelligence?.executiveSummary?.confidence ?? analysis.confidence,
        researchedAt: observedAt,
      },
    });
    await tx.websiteAnalysis.upsert({
      where: { companyId: input.companyId },
      create: {
        workspaceId: input.workspaceId,
        companyId: input.companyId,
        ...scores,
        analyzedPages:
          structuredWebsite?.analyzedPages ??
          [
            item.company.website,
            ...(item.research?.evidence ?? [])
              .filter((evidence) =>
                ["WEBSITE", "ABOUT", "SERVICES", "CAREERS", "CONTACT"].includes(
                  evidence.kind,
                ),
              )
              .map((evidence) => evidence.sourceUrl),
          ].filter((value): value is string => Boolean(value)),
        issues: issueRows as Prisma.InputJsonValue,
        recommendations: recommendations as Prisma.InputJsonValue,
        businessOpportunities: businessOpportunities as Prisma.InputJsonValue,
        missingFeatures:
          structuredWebsite?.missingFeatures ??
          analysis.painPoints.map((point) => point.claim),
        evidenceRefs,
        confidence: analysis.confidence,
        observedAt,
      },
      update: {
        ...scores,
        analyzedPages: structuredWebsite?.analyzedPages,
        issues: issueRows as Prisma.InputJsonValue,
        recommendations: recommendations as Prisma.InputJsonValue,
        businessOpportunities: businessOpportunities as Prisma.InputJsonValue,
        missingFeatures:
          structuredWebsite?.missingFeatures ??
          analysis.painPoints.map((point) => point.claim),
        evidenceRefs,
        confidence: analysis.confidence,
        observedAt,
      },
    });
    if (intelligence?.technologyDetection?.technologies.length) {
      await tx.company.update({
        where: { id: input.companyId },
        data: {
          technologies: Array.from(
            new Set([
              ...item.company.technologies,
              ...intelligence.technologyDetection.technologies.map(
                (technology) => technology.name,
              ),
            ]),
          ),
        },
      });
    }
    if (signals.length) {
      await tx.buyingSignal.createMany({
        data: signals.map((signal) => ({
          workspaceId: input.workspaceId,
          companyId: input.companyId,
          fingerprint: hashIdentifier(
            `${input.companyId}:${signal.type}:${signal.title}:${signal.observedAt.toISOString()}`,
          ),
          type: signal.type,
          title: signal.title,
          detail: signal.detail,
          strength: signal.strength,
          confidence: signal.confidence,
          sourceUrl: signal.sourceUrl,
          evidenceRefs: signal.evidenceRefs,
          observedAt: signal.observedAt,
        })),
        skipDuplicates: true,
      });
      await tx.companyTimelineEvent.createMany({
        data: signals.map((signal) => ({
          workspaceId: input.workspaceId,
          companyId: input.companyId,
          fingerprint: hashIdentifier(
            `timeline:${input.companyId}:${signal.type}:${signal.title}:${signal.observedAt.toISOString()}`,
          ),
          type: signal.type,
          title: signal.title,
          detail: signal.detail,
          confidence: signal.confidence,
          sourceUrl: signal.sourceUrl,
          evidenceRefs: signal.evidenceRefs,
          occurredAt: signal.observedAt,
        })),
        skipDuplicates: true,
      });
    }
    const taskTitle = `Review ${item.company.name} intelligence`;
    const existingTask = await tx.salesTask.findFirst({
      where: {
        workspaceId: input.workspaceId,
        companyId: input.companyId,
        searchResultId: input.searchResultId,
        title: taskTitle,
        status: "OPEN",
      },
      select: { id: true },
    });
    if (!existingTask) {
      await tx.salesTask.create({
        data: {
          workspaceId: input.workspaceId,
          companyId: input.companyId,
          searchResultId: input.searchResultId,
          title: taskTitle,
          description: analysis.suggestedOffer,
          priority: analysis.buyingIntent === "HIGH" ? "HIGH" : "MEDIUM",
        },
      });
    }
  });
}

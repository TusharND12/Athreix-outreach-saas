import type { z } from "zod";
import { env } from "@/lib/server/env";
import { privacySafetyIdentifier } from "@/lib/server/crypto";
import { AsyncSemaphore } from "@/server/concurrency";
import type { ProspectAnalysis } from "@/server/ai";
import type { NormalizedB2BProspect } from "@/server/normalize";
import {
  runStructuredIntelligence,
  type StructuredIntelligenceResult,
} from "@/server/intelligence/openrouter";
import {
  buyingIntentSchema,
  companySummarySchema,
  competitorAnalysisSchema,
  executiveSummarySchema,
  industryAnalysisSchema,
  intelligenceSchemas,
  outreachSchema,
  painPointSchema,
  salesStrategySchema,
  technologyDetectionSchema,
  websiteAuditSchema,
  type IntelligenceTaskName,
} from "@/server/intelligence/schemas";

const researchSemaphore = new AsyncSemaphore(
  env.OPENROUTER_RESEARCH_CONCURRENCY,
);

export type CompanyResearchIntelligence = {
  companySummary?: z.infer<typeof companySummarySchema>;
  buyingIntent?: z.infer<typeof buyingIntentSchema>;
  painPoints?: z.infer<typeof painPointSchema>;
  websiteAudit?: z.infer<typeof websiteAuditSchema>;
  technologyDetection?: z.infer<typeof technologyDetectionSchema>;
  salesStrategy?: z.infer<typeof salesStrategySchema>;
  outreach?: z.infer<typeof outreachSchema>;
  executiveSummary?: z.infer<typeof executiveSummarySchema>;
  competitorAnalysis?: z.infer<typeof competitorAnalysisSchema>;
  industryAnalysis?: z.infer<typeof industryAnalysisSchema>;
  model: string;
  promptVersion: string;
};

async function runTask<TTask extends IntelligenceTaskName>(
  task: TTask,
  input: unknown,
  options: { deadlineAt?: number; user: string },
): Promise<StructuredIntelligenceResult<
  z.infer<(typeof intelligenceSchemas)[TTask]>
> | null> {
  try {
    return await researchSemaphore.run(() =>
      runStructuredIntelligence(task, input, {
        kind: "research",
        deadlineAt: options.deadlineAt,
        user: options.user,
      }),
    );
  } catch (error) {
    console.warn(
      `OpenRouter ${task} task failed`,
      error instanceof Error ? error.message : "unknown error",
    );
    return null;
  }
}

export async function researchCompanyIntelligence(input: {
  item: NormalizedB2BProspect;
  analysis: ProspectAnalysis;
  query: string;
  purpose: string;
  workspaceId: string;
  userId: string;
  deadlineAt?: number;
}): Promise<CompanyResearchIntelligence | null> {
  if (!env.openRouterEnabled) return null;
  const user = privacySafetyIdentifier(input.workspaceId, input.userId);
  const evidence = (input.item.research?.evidence ?? [])
    .slice(0, 40)
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      title: item.title,
      excerpt: item.excerpt.slice(0, 800),
      sourceUrl: item.sourceUrl,
      observedAt: item.observedAt,
      confidence: item.confidence,
    }));
  const signals = (input.item.research?.signals ?? []).slice(0, 25);
  const base = {
    campaign: { query: input.query, purpose: input.purpose },
    company: {
      name: input.item.company.name,
      domain: input.item.company.domain,
      website: input.item.company.website,
      description: input.item.company.description,
      industry: input.item.company.industry,
      location: input.item.company.location,
      employeeCount: input.item.company.employeeCount,
      employeeRange: input.item.company.employeeRange,
      revenueRange: input.item.company.revenueRange,
      foundedYear: input.item.company.foundedYear,
      technologies: input.item.company.technologies,
      keywords: input.item.company.keywords,
      fundingStage: input.item.company.fundingStage,
      isHiring: input.item.company.isHiring,
      websiteQuality: input.item.company.websiteQuality,
    },
    decisionMakerContext: {
      role: input.item.contact.title,
      seniority: input.item.contact.seniority,
    },
    evidence,
    observedSignals: signals,
    currentQualification: input.analysis,
    groundingRule:
      "Every factual claim must cite one or more evidence ids from the supplied evidence array. Leave unsupported facts unknown.",
  };
  const options = {
    deadlineAt: input.deadlineAt,
    user,
  };

  const [summary, buyingIntent, painPoints, websiteAudit, technology] =
    await Promise.all([
      runTask("companySummary", base, options),
      runTask("buyingIntent", base, options),
      runTask("painPoints", base, options),
      runTask("websiteAudit", base, options),
      runTask("technologyDetection", base, options),
    ]);

  const synthesized = {
    ...base,
    findings: {
      companySummary: summary?.data,
      buyingIntent: buyingIntent?.data,
      painPoints: painPoints?.data,
      websiteAudit: websiteAudit?.data,
      technologyDetection: technology?.data,
    },
  };
  const [strategy, outreach, executive, competitors, industry] =
    await Promise.all([
      runTask("salesStrategy", synthesized, options),
      runTask("outreach", synthesized, options),
      runTask("executiveSummary", synthesized, options),
      runTask("competitorAnalysis", synthesized, options),
      runTask("industryAnalysis", synthesized, options),
    ]);
  const completed = [
    summary,
    buyingIntent,
    painPoints,
    websiteAudit,
    technology,
    strategy,
    outreach,
    executive,
    competitors,
    industry,
  ].filter((result) => result !== null);
  if (!completed.length) return null;
  return {
    companySummary: summary?.data,
    buyingIntent: buyingIntent?.data,
    painPoints: painPoints?.data,
    websiteAudit: websiteAudit?.data,
    technologyDetection: technology?.data,
    salesStrategy: strategy?.data,
    outreach: outreach?.data,
    executiveSummary: executive?.data,
    competitorAnalysis: competitors?.data,
    industryAnalysis: industry?.data,
    model: Array.from(new Set(completed.map((result) => result.model))).join(
      ", ",
    ),
    promptVersion: Array.from(
      new Set(completed.map((result) => result.promptVersion)),
    ).join(", "),
  };
}

import type { IntelligenceTaskName } from "@/server/intelligence/schemas";

const evidenceGuardrail =
  "Use only the supplied research evidence. Every factual claim must cite one or more supplied evidence reference IDs. Never invent a source, timestamp, person, metric, technology, event, or company fact. Clearly separate observed facts from cautious inference. Lower confidence when evidence is sparse, stale, contradictory, or indirect. Do not infer protected or sensitive personal traits.";

export const intelligencePrompts: Record<
  IntelligenceTaskName,
  {
    schemaName: string;
    version: string;
    instruction: string;
  }
> = {
  searchUnderstanding: {
    schemaName: "search_understanding",
    version: "search-understanding-v2",
    instruction:
      "Translate every sentence in the user's natural-language research request into a conservative, executable company-research plan. Populate only constraints the user stated or clearly implied, including included and excluded locations, roles, company size, revenue, funding, contact availability, website availability, technologies, and growth signals. Preserve the user's wording and intent, avoid adding constraints they did not request, surface assumptions, and ask for clarification only when proceeding would materially change the audience. For B2B research, choose only the Apify research stages that can produce useful public business evidence. For B2C, do not infer consent or authorize public-profile collection.",
  },
  companySummary: {
    schemaName: "company_summary",
    version: "company-summary-v1",
    instruction: `Produce a concise business profile that a sales operator can trust. ${evidenceGuardrail}`,
  },
  buyingIntent: {
    schemaName: "buying_intent",
    version: "buying-intent-v1",
    instruction: `Assess whether observable company activity suggests a timely business need. Recency, specificity, and source quality matter more than volume. ${evidenceGuardrail}`,
  },
  painPoints: {
    schemaName: "pain_points",
    version: "pain-points-v1",
    instruction: `Identify only problems supported by the supplied website and business evidence. Describe the business impact without exaggeration and do not convert missing data into a negative claim. ${evidenceGuardrail}`,
  },
  websiteAudit: {
    schemaName: "website_audit",
    version: "website-audit-v1",
    instruction: `Audit the supplied public website observations across UX, UI, branding, performance, accessibility, SEO, content, responsiveness, calls to action, trust, forms, and security. Treat scanner results as observations, not guarantees. ${evidenceGuardrail}`,
  },
  technologyDetection: {
    schemaName: "technology_detection",
    version: "technology-detection-v1",
    instruction: `Normalize detected technologies into clear categories. Do not infer a technology from visual similarity or generic HTML. Unknown versions must be null. ${evidenceGuardrail}`,
  },
  leadQualification: {
    schemaName: "lead_qualification",
    version: "lead-qualification-v3",
    instruction: `Act as an evidence-first AI sales analyst. Explain fit, business momentum, digital maturity, likely needs, the most relevant service, and the best verified decision-maker. The deterministic score is an auditable anchor and the final overall score may differ by no more than eight points. ${evidenceGuardrail}`,
  },
  salesStrategy: {
    schemaName: "sales_strategy",
    version: "sales-strategy-v1",
    instruction: `Create a restrained, practical account strategy. Recommend only services connected to observed needs, explain why each approach could work, and include risks or evidence gaps. ${evidenceGuardrail}`,
  },
  outreach: {
    schemaName: "outreach_bundle",
    version: "outreach-bundle-v3",
    instruction: `Write truthful, concise drafts for manual one-to-one review. Use only supplied evidence, never pretend there is an existing relationship, avoid unverifiable praise, manipulation, false urgency, sensitive-trait inference, or mass-message language. Email drafts must include a plain opt-out sentence. This system drafts text only and never sends it. ${evidenceGuardrail}`,
  },
  executiveSummary: {
    schemaName: "executive_summary",
    version: "executive-summary-v1",
    instruction: `Produce an executive briefing that prioritizes decision-useful findings, opportunities, risks, and the next best action. ${evidenceGuardrail}`,
  },
  competitorAnalysis: {
    schemaName: "competitor_analysis",
    version: "competitor-analysis-v1",
    instruction: `Compare only named companies present in the supplied evidence. Avoid unsupported market-share or financial claims. ${evidenceGuardrail}`,
  },
  industryAnalysis: {
    schemaName: "industry_analysis",
    version: "industry-analysis-v1",
    instruction: `Summarize the supplied industry evidence, technology adoption, buying trends, and realistic sales opportunities. Do not generalize beyond the evidence set. ${evidenceGuardrail}`,
  },
  companyChat: {
    schemaName: "company_chat_answer",
    version: "company-chat-v1",
    instruction: `Answer the operator's question from the supplied company dossier. Say when the evidence cannot answer the question. Keep the answer direct and cite the supporting evidence reference IDs. ${evidenceGuardrail}`,
  },
};

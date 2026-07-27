import { z } from "zod";
import { env } from "@/lib/server/env";
import { privacySafetyIdentifier } from "@/lib/server/crypto";
import type { NormalizedProspect } from "@/server/normalize";
import type { ScoreResult } from "@/server/scoring";
import { AsyncSemaphore } from "@/server/concurrency";
import {
  openRouterRequestOptions,
  runStructuredIntelligence,
} from "@/server/intelligence/openrouter";
import {
  companyChatAnswerSchema,
  leadQualificationSchema,
  searchUnderstandingSchema,
} from "@/server/intelligence/schemas";
import type { CompanyIntelligence } from "@/lib/intelligence/types";

const scoringSemaphore = new AsyncSemaphore(env.OPENROUTER_SCORING_CONCURRENCY);

export { openRouterRequestOptions };

export type ProspectAnalysis = z.infer<typeof leadQualificationSchema> & {
  model: string;
  promptVersion: string;
  tokensInput?: number;
  tokensOutput?: number;
  latencyMs?: number;
  usedFallback: boolean;
  fallbackReason?: "not_configured" | "budget_exhausted" | "provider_error";
};

type ProspectAnalysisInput = {
  item: NormalizedProspect;
  deterministic: ScoreResult;
  query: string;
  purpose: string;
  workspaceId: string;
  userId: string;
};

function safeProspectContext(item: NormalizedProspect) {
  if (item.mode === "B2C") {
    return {
      mode: item.mode,
      ageBand: item.consumer.ageBand,
      location: item.consumer.location,
      declaredInterests: item.consumer.interests,
      consentStatus: item.consumer.consentStatus,
      explicitlyPermittedChannels: item.consumer.consentChannels,
      sourceType: item.provenance.sourceType,
    };
  }
  return {
    mode: item.mode,
    company: item.company,
    professionalRole: item.contact.title,
    seniority: item.contact.seniority,
    location: item.contact.location,
    sourceType: item.provenance.sourceType,
    researchEvidence: item.research?.evidence ?? [],
    observedSignals: item.research?.signals ?? [],
  };
}

function deterministicBreakdown(
  input: ProspectAnalysisInput,
): z.infer<typeof leadQualificationSchema>["scoreBreakdown"] {
  const breakdown = input.deterministic.breakdown;
  const pick = (...keys: string[]) =>
    Math.max(
      0,
      Math.min(
        100,
        Math.round(
          keys.reduce((sum, key) => sum + (breakdown[key] ?? 0), 0) *
            (100 / Math.max(1, keys.length * 20)),
        ),
      ),
    );
  if (input.item.mode === "B2C") {
    return {
      websiteQuality: 0,
      technology: 0,
      businessGrowth: pick("audienceMatch", "interests"),
      buyingIntent: input.deterministic.score,
      digitalMaturity: 0,
      decisionMakers: 0,
      evidenceConfidence: input.deterministic.confidence,
    };
  }
  return {
    websiteQuality:
      input.item.company.websiteQuality ??
      pick("website", "technology", "company"),
    technology: input.item.company.technologies.length
      ? Math.min(100, 55 + input.item.company.technologies.length * 6)
      : pick("technology"),
    businessGrowth: input.item.company.isHiring
      ? Math.max(72, pick("company", "intent"))
      : pick("company", "intent"),
    buyingIntent: input.deterministic.score,
    digitalMaturity: pick("website", "technology"),
    decisionMakers: pick("role", "seniority", "contactability"),
    evidenceConfidence: input.deterministic.confidence,
  };
}

export function deterministicProspectAnalysis(
  input: ProspectAnalysisInput,
  fallbackReason: ProspectAnalysis["fallbackReason"] = "not_configured",
): ProspectAnalysis {
  const promptVersion = "lead-qualification-v3";
  const b2bItem = input.item.mode === "B2B" ? input.item : null;
  const evidenceReasons = input.deterministic.reasons.slice(0, 5);
  const researchClaims = b2bItem
    ? (b2bItem.research?.evidence ?? []).slice(0, 3).map((item) => ({
        claim: item.excerpt,
        evidenceRefs: [item.id],
        confidence: item.confidence,
      }))
    : [];
  return {
    score: input.deterministic.score,
    buyingIntent: input.deterministic.intent,
    summary: b2bItem
      ? `${b2bItem.contact.fullName} at ${b2bItem.company.name} matches the campaign across role, company context, and the currently available business evidence. Verify freshness and relevance before contact.`
      : "This consent-aware audience record aligns with the declared campaign context based on location, stated interests, contactability, and permission evidence. Confirm the permission scope before use.",
    reasons:
      evidenceReasons.length >= 3
        ? evidenceReasons
        : [
            ...evidenceReasons,
            "The record matches confirmed search criteria",
            "Evidence confidence is included in the qualification",
            "The recommendation requires manual review",
          ].slice(0, 3),
    suggestedOffer: b2bItem
      ? "A concise, evidence-backed assessment tied to the company’s current priorities."
      : "A permission-appropriate offer directly connected to the person’s stated interest.",
    decisionMakerConfidence: b2bItem ? input.deterministic.confidence : 0,
    recommendedChannel:
      input.item.mode === "B2C"
        ? input.item.consumer.consentChannels.includes("EMAIL")
          ? "EMAIL"
          : "REVIEW_REQUIRED"
        : input.item.contact.email
          ? "EMAIL"
          : input.item.contact.linkedinUrl
            ? "LINKEDIN"
            : "REVIEW_REQUIRED",
    scoreBreakdown: deterministicBreakdown(input),
    painPoints: researchClaims,
    buyingSignals: b2bItem
      ? (b2bItem.research?.signals ?? []).slice(0, 5).map((signal) => ({
          claim: `${signal.title}: ${signal.detail}`,
          evidenceRefs: signal.evidenceRefs,
          confidence: signal.confidence,
        }))
      : [],
    recommendedServices: b2bItem
      ? [
          "Evidence-backed digital opportunity assessment",
          "Sales workflow and automation review",
        ]
      : [],
    confidence: input.deterministic.confidence,
    model: "deterministic-v3",
    promptVersion,
    usedFallback: true,
    fallbackReason,
  };
}

export async function analyzeProspect(
  input: ProspectAnalysisInput,
  options: { deadlineAt?: number; forceFallback?: boolean } = {},
): Promise<ProspectAnalysis> {
  if (options.forceFallback) {
    return deterministicProspectAnalysis(input, "budget_exhausted");
  }
  return scoringSemaphore.run(async () => {
    const requestOptions = openRouterRequestOptions(
      "scoring",
      options.deadlineAt,
    );
    if (!requestOptions) {
      return deterministicProspectAnalysis(input, "budget_exhausted");
    }
    try {
      const response = await runStructuredIntelligence(
        "leadQualification",
        {
          campaign: { query: input.query, purpose: input.purpose },
          prospect: safeProspectContext(input.item),
          deterministicScore: input.deterministic,
          scoringRule:
            "The final score must remain within eight points of deterministicScore.score.",
        },
        {
          kind: "scoring",
          deadlineAt: options.deadlineAt,
          user: privacySafetyIdentifier(input.workspaceId, input.userId),
        },
      );
      if (!response) {
        return deterministicProspectAnalysis(input, "not_configured");
      }
      const anchoredScore = Math.max(
        0,
        Math.min(
          100,
          Math.max(
            input.deterministic.score - 8,
            Math.min(input.deterministic.score + 8, response.data.score),
          ),
        ),
      );
      const permittedRecommendation =
        input.item.mode === "B2C" &&
        response.data.recommendedChannel !== "REVIEW_REQUIRED" &&
        !input.item.consumer.consentChannels.includes(
          response.data.recommendedChannel,
        )
          ? "REVIEW_REQUIRED"
          : response.data.recommendedChannel;
      return {
        ...response.data,
        score: anchoredScore,
        recommendedChannel: permittedRecommendation,
        model: response.model,
        promptVersion: response.promptVersion,
        tokensInput: response.tokensInput,
        tokensOutput: response.tokensOutput,
        latencyMs: response.latencyMs,
        usedFallback: false,
      };
    } catch (error) {
      console.warn(
        "OpenRouter analysis used deterministic fallback",
        error instanceof Error ? error.message : "unknown error",
      );
      return deterministicProspectAnalysis(input, "provider_error");
    }
  });
}

export async function generateOutreachDraft(input: {
  item: NormalizedProspect;
  type:
    | "COLD_EMAIL"
    | "LINKEDIN_MESSAGE"
    | "LINKEDIN_CONNECTION"
    | "FOLLOW_UP"
    | "WHATSAPP";
  tone: "professional" | "friendly" | "direct" | "premium";
  offer?: string;
  context?: string;
  analysis: Pick<ProspectAnalysis, "summary" | "reasons" | "suggestedOffer">;
  workspaceId: string;
  userId: string;
}) {
  const promptVersion = "outreach-bundle-v3";
  const firstName =
    input.item.mode === "B2B"
      ? (input.item.contact.firstName ??
        input.item.contact.fullName.split(" ")[0])
      : "there";
  const company =
    input.item.mode === "B2B" ? input.item.company.name : undefined;
  const fallback = {
    subject:
      input.type === "COLD_EMAIL"
        ? `A focused idea${company ? ` for ${company}` : ""}`
        : undefined,
    body: `Hi ${firstName},\n\n${input.analysis.reasons[0] ?? "I noticed a relevant business signal"}. I thought ${input.offer ?? input.analysis.suggestedOffer.toLowerCase()} might be useful.\n\nWould a brief conversation be worthwhile? This is a draft for manual review—please tailor it to the evidence and your relationship before using it.${input.type === "COLD_EMAIL" ? "\n\nIf this is not relevant, let me know and I will not follow up." : ""}`,
    model: "deterministic-v3",
    promptVersion,
    usedFallback: true,
  };
  try {
    const response = await runStructuredIntelligence(
      "outreach",
      {
        requestedChannel: input.type,
        tone: input.tone,
        recipient: safeProspectContext(input.item),
        analysis: input.analysis,
        offer: input.offer,
        additionalContext: input.context,
      },
      {
        kind: "outreach",
        user: privacySafetyIdentifier(input.workspaceId, input.userId),
      },
    );
    if (!response) return fallback;
    const selected =
      input.type === "COLD_EMAIL"
        ? response.data.coldEmail
        : input.type === "FOLLOW_UP"
          ? response.data.followUpEmail
          : input.type === "LINKEDIN_MESSAGE" ||
              input.type === "LINKEDIN_CONNECTION" ||
              input.type === "WHATSAPP"
            ? response.data.linkedinMessage
            : response.data.meetingInvitation;
    return {
      subject: selected.subject ?? undefined,
      body: selected.body,
      model: response.model,
      promptVersion: response.promptVersion,
      usedFallback: false,
    };
  } catch (error) {
    console.warn(
      "OpenRouter outreach generation used fallback",
      error instanceof Error ? error.message : "unknown error",
    );
    return fallback;
  }
}

function uniqueText(values: Array<string | undefined>) {
  const seen = new Set<string>();
  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function parseBusinessAmount(value: string) {
  const amount = Number(value.replaceAll(",", "").match(/\d+(?:\.\d+)?/)?.[0]);
  if (!Number.isFinite(amount)) return null;
  const normalized = value.toLowerCase();
  const multiplier = /\b(?:b|billion)\b/.test(normalized)
    ? 1_000_000_000
    : /\b(?:m|million|crore)\b/.test(normalized)
      ? normalized.includes("crore")
        ? 10_000_000
        : 1_000_000
      : /\b(?:k|thousand|lakh)\b/.test(normalized)
        ? normalized.includes("lakh")
          ? 100_000
          : 1_000
        : 1;
  return amount * multiplier;
}

function parseRevenueConstraint(query: string) {
  const amount = String.raw`[$₹€£]?\s*\d[\d,.]*\s*(?:k|m|b|thousand|million|billion|lakh|crore)?`;
  const range =
    query.match(
      new RegExp(
        String.raw`\b(?:revenue|turnover)\b[^\d$₹€£]{0,24}(${amount})\s*(?:-|–|—|to)\s*(${amount})`,
        "i",
      ),
    ) ??
    query.match(
      new RegExp(
        String.raw`(${amount})\s*(?:-|–|—|to)\s*(${amount})\s+(?:in\s+)?(?:annual\s+)?(?:revenue|turnover)\b`,
        "i",
      ),
    );
  if (range?.[1] && range[2]) {
    const first = parseBusinessAmount(range[1]);
    const second = parseBusinessAmount(range[2]);
    if (first !== null && second !== null) {
      return {
        revenueMin: Math.min(first, second),
        revenueMax: Math.max(first, second),
      };
    }
  }

  const minimum =
    query.match(
      new RegExp(
        String.raw`\b(?:more than|over|above|at least|minimum|min)\s+(${amount})\s+(?:in\s+)?(?:annual\s+)?(?:revenue|turnover)\b`,
        "i",
      ),
    ) ??
    query.match(
      new RegExp(
        String.raw`\b(?:revenue|turnover)\b[^\d$₹€£]{0,16}(?:more than|over|above|at least|minimum|min)\s+(${amount})`,
        "i",
      ),
    );
  if (minimum?.[1]) {
    return {
      revenueMin: parseBusinessAmount(minimum[1]),
      revenueMax: null,
    };
  }

  const maximum =
    query.match(
      new RegExp(
        String.raw`\b(?:fewer than|less than|under|below|at most|up to|maximum|max)\s+(${amount})\s+(?:in\s+)?(?:annual\s+)?(?:revenue|turnover)\b`,
        "i",
      ),
    ) ??
    query.match(
      new RegExp(
        String.raw`\b(?:revenue|turnover)\b[^\d$₹€£]{0,16}(?:fewer than|less than|under|below|at most|up to|maximum|max)\s+(${amount})`,
        "i",
      ),
    );
  return {
    revenueMin: null,
    revenueMax: maximum?.[1] ? parseBusinessAmount(maximum[1]) : null,
  };
}

function deterministicSearchUnderstanding(
  query: string,
  requestedMode: "B2B" | "B2C" = "B2B",
): z.infer<typeof searchUnderstandingSchema> {
  const normalized = query.toLowerCase();
  const excludedLocationMatches = [
    ...query.matchAll(
      /\b(?:excluding|exclude|except(?: for)?|outside(?: of)?|but not in|not in)\s+([A-Za-z][A-Za-z .-]{1,60}?)(?=\s+(?:with|without|using|that|who|hiring|and|for|targeting|employing|needing|looking)\b|[,.]|$)/gi,
    ),
  ];
  const excludedLocations = uniqueText(
    excludedLocationMatches.map((match) => match[1]),
  );
  const locationMatches = [
    ...query.matchAll(
      /\b(?:in|near|around|across)\s+([A-Za-z][A-Za-z .-]{1,60}?)(?=\s+(?:with|without|using|that|who|hiring|and|for|targeting|employing|needing|looking|except|excluding)\b|[,.]|$)/gi,
    ),
  ];
  const nonLocationPhrases = new Set([
    "revenue",
    "annual revenue",
    "turnover",
    "business",
    "companies",
    "company",
    "the market",
    "the industry",
  ]);
  const locations = uniqueText(locationMatches.map((match) => match[1])).filter(
    (location) =>
      !nonLocationPhrases.has(location.toLowerCase()) &&
      !excludedLocations.some(
        (excluded) => excluded.toLowerCase() === location.toLowerCase(),
      ),
  );
  const hiringRoleMatch = query.match(
    /\bhiring\s+([A-Za-z][A-Za-z /&+-]{1,50}?)(?=[,.]|\s+(?:in|with|using|and)\b|$)/i,
  );
  const employeeRangeMatch = query.match(
    /\b([\d,]+)\s*(?:-|–|—|to)\s*([\d,]+)\s*(?:employees|people|staff|workers)\b/i,
  );
  const employeeMinimumMatch = query.match(
    /\b(more than|over|above|at least)\s+([\d,]+)\s+(?:employees|people|staff|workers)\b/i,
  );
  const employeePlusMatch = query.match(
    /\b([\d,]+)\+\s*(?:employees|people|staff|workers)\b/i,
  );
  const employeeMaximumMatch = query.match(
    /\b(?:fewer than|under|below|at most)\s+([\d,]+)\s+(?:employees|people|staff|workers)\b/i,
  );
  const parsedMinimum = employeeRangeMatch?.[1]
    ? Number(employeeRangeMatch[1].replaceAll(",", ""))
    : employeeMinimumMatch?.[2]
      ? Number(employeeMinimumMatch[2].replaceAll(",", "")) +
        (/more than|over|above/i.test(employeeMinimumMatch[1] ?? "") ? 1 : 0)
      : employeePlusMatch?.[1]
        ? Number(employeePlusMatch[1].replaceAll(",", ""))
        : null;
  const parsedMaximum = employeeRangeMatch?.[2]
    ? Number(employeeRangeMatch[2].replaceAll(",", ""))
    : employeeMaximumMatch?.[1]
      ? Number(employeeMaximumMatch[1].replaceAll(",", "")) -
        (/fewer than|under|below/i.test(employeeMaximumMatch[0]) ? 1 : 0)
      : null;
  const industryMatches = [
    { label: "SaaS", terms: ["saas", "software startup"] },
    { label: "Architecture", terms: ["architecture", "architect"] },
    {
      label: "Manufacturing",
      terms: [
        "manufacturing",
        "manufacturer",
        "manufacturers",
        "manufacture",
        "manufactures",
        "industrial",
      ],
    },
    {
      label: "Construction",
      terms: ["builder", "construction", "property developer"],
    },
    { label: "Agency", terms: ["agency", "agencies"] },
    { label: "Healthcare", terms: ["healthcare", "health care", "clinic"] },
    { label: "Retail", terms: ["retail", "retailer"] },
    { label: "Fintech", terms: ["fintech", "financial technology"] },
    { label: "E-commerce", terms: ["ecommerce", "e-commerce"] },
  ]
    .filter(({ terms }) => terms.some((term) => normalized.includes(term)))
    .map(({ label }) => label);
  const companyDescriptorMatch = query.match(
    /\bfor\s+(?:(?:a|an|the)\s+)?([A-Za-z][A-Za-z0-9 /&+-]{1,40}?)\s+(?:companies|company|businesses|business|manufacturers|manufacturer)\b/i,
  );
  const companyDescriptor = companyDescriptorMatch?.[1]
    ?.trim()
    .replace(/\b(?:a|an|the)\s+/i, "");
  const technologyMatches = [
    "WordPress",
    "Webflow",
    "Shopify",
    "Salesforce",
    "HubSpot",
    "React",
    "Next.js",
  ].filter((technology) => normalized.includes(technology.toLowerCase()));
  const titleMatches = [
    { label: "Founder", terms: ["founder", "co-founder", "cofounder"] },
    { label: "CEO", terms: ["ceo", "chief executive"] },
    { label: "CTO", terms: ["cto", "chief technology"] },
    { label: "Owner", terms: ["owner", "business owners"] },
    {
      label: "Managing Director",
      terms: ["managing director", "managing directors"],
    },
    { label: "Director", terms: ["director", "directors"] },
    { label: "Head of Sales", terms: ["head of sales", "sales head"] },
    { label: "VP Sales", terms: ["vp sales", "vice president of sales"] },
  ]
    .filter(({ terms }) => terms.some((term) => normalized.includes(term)))
    .map(({ label }) => label);
  const fundingStages = [
    { label: "Pre-seed", terms: ["pre-seed", "pre seed"] },
    { label: "Seed", terms: ["seed funded", "seed-stage", "seed stage"] },
    { label: "Series A", terms: ["series a"] },
    { label: "Series B", terms: ["series b"] },
    { label: "Series C+", terms: ["series c", "series d", "late stage"] },
    { label: "Bootstrapped", terms: ["bootstrapped", "self-funded"] },
  ]
    .filter(({ terms }) => terms.some((term) => normalized.includes(term)))
    .map(({ label }) => label);
  const revenue = parseRevenueConstraint(query);
  const emailRequirement: "ANY" | "AVAILABLE" =
    /\b(?:verified|valid|available|public|business|work)\s+emails?\b|\bwith\s+(?:an?\s+)?emails?(?:\s+address)?\b/i.test(
      query,
    )
      ? "AVAILABLE"
      : "ANY";
  const websiteRequirement: "ANY" | "PRESENT" | "MISSING" =
    /\b(?:without|no|missing|lacking)\s+(?:an?\s+)?(?:company\s+)?websites?\b/i.test(
      query,
    )
      ? "MISSING"
      : /\bwebsites?\b/i.test(query)
        ? "PRESENT"
        : "ANY";
  const plan =
    requestedMode === "B2C"
      ? (["company_profile"] as const)
      : ([
          "google_search",
          "google_maps",
          "website",
          "contact",
          "about",
          "services",
          "careers",
          "news",
          "reviews",
          "social",
        ] as const);
  return {
    mode: requestedMode,
    intent: query,
    targetDescription: query,
    filters: {
      industries: industryMatches,
      locations,
      excludedLocations,
      employeeMin: Number.isFinite(parsedMinimum) ? parsedMinimum : null,
      employeeMax: Number.isFinite(parsedMaximum) ? parsedMaximum : null,
      revenueMin: revenue.revenueMin,
      revenueMax: revenue.revenueMax,
      jobTitles: uniqueText([...titleMatches, hiringRoleMatch?.[1]?.trim()]),
      technologies: technologyMatches,
      keywords: uniqueText([
        ...(/\bAI\b/i.test(query) ? ["AI"] : []),
        companyDescriptor,
      ]),
      fundingStages,
      emailRequirement,
      websiteRequirement,
      websiteSignals: [
        ...(normalized.includes("outdated") ? ["outdated website"] : []),
        ...(normalized.includes("weak branding") ? ["weak branding"] : []),
        ...(normalized.includes("no chatbot") ? ["no chatbot"] : []),
        ...(normalized.includes("poor seo") || normalized.includes("weak seo")
          ? ["weak SEO"]
          : []),
      ],
      growthSignals: [
        ...(normalized.includes("hiring") ? ["active hiring"] : []),
        ...(normalized.includes("expanding") ||
        normalized.includes("expansion") ||
        normalized.includes("new office")
          ? ["expansion"]
          : []),
      ],
      isHiring: normalized.includes("hiring") ? true : null,
    },
    researchPlan: [...plan],
    assumptions: [
      "Only public business information and reviewed Apify Actors will be used.",
      ...(emailRequirement === "AVAILABLE" &&
      /\b(?:verified|valid)\s+emails?\b/i.test(query)
        ? [
            "Email availability will be checked from public evidence; deliverability is not guaranteed.",
          ]
        : []),
    ],
    clarificationNeeded: false,
    clarificationQuestion: null,
    confidence:
      industryMatches.length > 0 ||
      locations.length > 0 ||
      technologyMatches.length > 0
        ? 72
        : 62,
  };
}

export async function interpretSearchBrief(input: {
  query: string;
  mode?: "B2B" | "B2C";
  workspaceId: string;
  userId: string;
}) {
  const fallback = deterministicSearchUnderstanding(
    input.query,
    input.mode ?? "B2B",
  );
  try {
    const response = await runStructuredIntelligence(
      "searchUnderstanding",
      {
        query: input.query,
        requestedMode: input.mode,
        allowedProviders: ["APIFY"],
        allowedInferenceProvider: "OPENROUTER",
      },
      {
        kind: "research",
        user: privacySafetyIdentifier(input.workspaceId, input.userId),
      },
    );
    return response?.data ?? fallback;
  } catch {
    return fallback;
  }
}

export async function answerCompanyQuestion(input: {
  question: string;
  dossier: unknown;
  workspaceId: string;
  userId: string;
}): Promise<z.infer<typeof companyChatAnswerSchema>> {
  const dossier = input.dossier as Partial<CompanyIntelligence>;
  const question = input.question.toLowerCase();
  const primaryDecisionMaker = dossier.decisionMakers?.[0];
  const firstEvidence =
    dossier.evidence?.slice(0, 3).map((item) => item.id) ?? [];
  const deterministicAnswer = question.match(/who|contact|decision/)
    ? primaryDecisionMaker
      ? `The strongest supported contact is ${primaryDecisionMaker.name}, ${primaryDecisionMaker.role}. ${primaryDecisionMaker.reasonToContact}`
      : "No decision-maker has enough retained evidence yet."
    : question.match(/service|sell|offer|proposal/)
      ? dossier.salesStrategy?.recommendedServices?.length
        ? `The best-supported services are ${dossier.salesStrategy.recommendedServices.join(", ")}. ${dossier.salesStrategy.bestApproach}`
        : "The retained evidence does not support a specific service recommendation yet."
      : question.match(/problem|pain|weak|issue/)
        ? dossier.painPoints?.length
          ? dossier.painPoints
              .slice(0, 3)
              .map(
                (point) =>
                  `${point.title}: ${point.problem} ${point.businessImpact}`,
              )
              .join("\n\n")
          : "No evidence-backed pain points are currently retained."
        : question.match(/intent|why now|signal|growing/)
          ? dossier.buyingSignals?.length
            ? dossier.buyingSignals
                .slice(0, 3)
                .map((signal) => `${signal.title}: ${signal.detail}`)
                .join("\n\n")
            : "No current buying signals are supported by retained evidence."
          : dossier.summary?.oneLiner
            ? `${dossier.summary.oneLiner} ${dossier.description ?? ""}`.trim()
            : "The currently retained evidence is not sufficient for a company summary.";
  const fallback = {
    answer: deterministicAnswer,
    evidenceRefs:
      question.match(/who|contact|decision/) &&
      dossier.decisionMakers?.[0]?.evidenceRefs
        ? dossier.decisionMakers[0].evidenceRefs
        : question.match(/problem|pain|weak|issue/) &&
            dossier.painPoints?.[0]?.evidenceRefs
          ? dossier.painPoints[0].evidenceRefs
          : question.match(/intent|why now|signal|growing/) &&
              dossier.buyingSignals?.[0]?.evidenceRefs
            ? dossier.buyingSignals[0].evidenceRefs
            : firstEvidence,
    confidence: dossier.scores?.confidence ?? 60,
    followUpQuestions: [
      "What evidence is available?",
      "Which decision-maker is best supported?",
    ],
  };
  try {
    const response = await runStructuredIntelligence(
      "companyChat",
      { question: input.question, dossier: input.dossier },
      {
        kind: "research",
        user: privacySafetyIdentifier(input.workspaceId, input.userId),
      },
    );
    return response?.data ?? fallback;
  } catch {
    return fallback;
  }
}

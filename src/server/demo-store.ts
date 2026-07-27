import type { z } from "zod";
import type { createSearchSchema } from "@/server/schemas";
import type { LeadRecord } from "@/lib/leads/columns";
import { env } from "@/lib/server/env";
import { AppError } from "@/lib/server/errors";
import { ApifyProspectProvider } from "@/server/providers/apify";
import { DemoProspectProvider } from "@/server/providers/demo";
import type { ProviderResult } from "@/server/providers/types";
import {
  dedupeProspects,
  normalizeProspect,
  type NormalizedProspect,
} from "@/server/normalize";
import { scoreProspect } from "@/server/scoring";
import { analyzeProspect } from "@/server/ai";
import { structuredFilterDecision } from "@/server/filtering";
import {
  candidateCollectionTarget,
  meetsScoreThreshold,
  selectTopQualified,
} from "@/server/qualification";
import {
  prepareLocalHistoryForStartup,
  readLocalSearchHistory,
  writeLocalSearchHistory,
} from "@/server/local-search-history";
import {
  prepareLocalLiveStateForStartup,
  readLocalLiveState,
  writeLocalLiveState,
} from "@/server/local-live-state";

type SearchInput = z.infer<typeof createSearchSchema>;

export type PublicProspect = {
  id: string;
  searchId: string;
  mode: "B2B" | "B2C";
  name: string;
  title?: string;
  company?: string;
  industry?: string;
  companySize?: string;
  location?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  website?: string;
  leadFields?: LeadRecord;
  score: number;
  rank: number;
  status: "verified" | "likely" | "unverified" | "suppressed";
  buyingIntent: "LOW" | "MEDIUM" | "HIGH";
  summary: string;
  reasons: string[];
  suggestedOffer: string;
  decisionMakerConfidence: number;
  recommendedChannel:
    "EMAIL" | "LINKEDIN" | "PHONE" | "WHATSAPP" | "REVIEW_REQUIRED";
  scoreBreakdown: Record<string, number>;
  isSuppressed: boolean;
  consentStatus?:
    "GRANTED" | "DENIED" | "WITHDRAWN" | "NOT_REQUIRED" | "UNKNOWN";
  evidence: Array<{
    field: string;
    provider: string;
    sourceUrl?: string;
    observedAt: string;
    confidence: number;
  }>;
  normalized: NormalizedProspect;
  createdAt: string;
};

export type DemoSearch = {
  id: string;
  name: string;
  query: string;
  mode: "B2B" | "B2C";
  purpose: string;
  lawfulBasis?: string;
  filters: Record<string, unknown>;
  targetCount: number;
  resultCount: number;
  status: "QUEUED" | "RUNNING" | "COMPLETE" | "FAILED";
  chargedCredits: number;
  retentionUntil: string;
  createdAt: string;
  completedAt?: string;
};

export type DemoJob = {
  id: string;
  searchId: string;
  status: "QUEUED" | "RUNNING" | "COMPLETE" | "FAILED";
  stage: string;
  progress: number;
  provider: string;
  createdAt: string;
  completedAt?: string;
};

type DemoList = {
  id: string;
  name: string;
  description?: string;
  folderId?: string;
  resultIds: string[];
  createdAt: string;
  updatedAt: string;
};
type DemoExport = {
  id: string;
  searchId?: string;
  listId?: string;
  format: "CSV" | "XLSX" | "JSON" | "PDF" | "CRM" | "AI_REPORT";
  status: "READY";
  recordCount: number;
  createdAt: string;
};
type DemoNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  actionUrl?: string;
  readAt?: string;
  createdAt: string;
};
type DemoOutreach = {
  id: string;
  resultId: string;
  type: string;
  tone: string;
  subject?: string;
  body: string;
  status: "DRAFT";
  model: string;
  createdAt: string;
};

type DemoState = {
  creditBalance: number;
  creditReserved: number;
  searches: DemoSearch[];
  jobs: DemoJob[];
  results: PublicProspect[];
  lists: DemoList[];
  exports: DemoExport[];
  notifications: DemoNotification[];
  outreach: DemoOutreach[];
};

const globalDemo = globalThis as unknown as { athreixDemo?: DemoState };

function fallbackAnalysis(
  item: NormalizedProspect,
  score: ReturnType<typeof scoreProspect>,
) {
  return {
    summary:
      item.mode === "B2B"
        ? `${item.contact.fullName} at ${item.company.name} is a strong candidate based on professional role, company fit, and current business signals.`
        : "This consumer record aligns with the declared audience based on stated interests, location, and documented permission status.",
    reasons: score.reasons,
    suggestedOffer:
      item.mode === "B2B"
        ? "A concise prospecting workflow and growth opportunity assessment."
        : "A permission-appropriate product introduction related to the stated interest.",
    decisionMakerConfidence: item.mode === "B2B" ? score.confidence : 0,
    recommendedChannel:
      item.mode === "B2C"
        ? item.consumer.consentChannels.includes("EMAIL")
          ? ("EMAIL" as const)
          : ("REVIEW_REQUIRED" as const)
        : item.contact.linkedinUrl
          ? ("LINKEDIN" as const)
          : ("REVIEW_REQUIRED" as const),
  };
}

function publicResult(
  item: NormalizedProspect,
  searchId: string,
  index: number,
  scoringContext: { query: string; filters: Record<string, unknown> },
): PublicProspect {
  const scored = scoreProspect(item, scoringContext);
  const analysis = fallbackAnalysis(item, scored);
  return {
    id: `demo-result-${index + 1}`,
    searchId,
    mode: item.mode,
    name:
      item.mode === "B2B" ? item.contact.fullName : item.consumer.displayName,
    title: item.mode === "B2B" ? item.contact.title : undefined,
    company: item.mode === "B2B" ? item.company.name : undefined,
    industry: item.mode === "B2B" ? item.company.industry : "Consumer audience",
    companySize: item.mode === "B2B" ? item.company.employeeRange : undefined,
    location:
      item.mode === "B2B" ? item.company.location : item.consumer.location,
    email: item.mode === "B2B" ? item.contact.email : item.consumer.email,
    phone: item.mode === "B2B" ? item.contact.phone : item.consumer.phone,
    linkedin: item.mode === "B2B" ? item.contact.linkedinUrl : undefined,
    website: item.mode === "B2B" ? item.company.website : undefined,
    leadFields: item.mode === "B2B" ? item.leadFields : undefined,
    score: Math.min(98, scored.score + Math.max(0, 8 - index * 2)),
    rank: index + 1,
    status: "likely",
    buyingIntent: scored.intent,
    summary: analysis.summary,
    reasons: analysis.reasons,
    suggestedOffer: analysis.suggestedOffer,
    decisionMakerConfidence: analysis.decisionMakerConfidence,
    recommendedChannel: analysis.recommendedChannel,
    scoreBreakdown: scored.breakdown,
    isSuppressed: false,
    consentStatus:
      item.mode === "B2C" ? item.consumer.consentStatus : undefined,
    evidence: [
      {
        field:
          item.mode === "B2B" ? "company_and_role" : "consent_and_interests",
        provider: item.provenance.provider,
        sourceUrl: item.sourceUrl,
        observedAt: item.provenance.collectedAt,
        confidence: 88,
      },
    ],
    normalized: item,
    createdAt: new Date(Date.now() - index * 3_600_000).toISOString(),
  };
}

function createInitialState(): DemoState {
  const searchId = "demo-search-b2b";
  const fixtures = new DemoProspectProvider();
  // Demo provider currently resolves synchronously inside its async wrapper; use a
  // compact local equivalent for initial state and replace it on the first search.
  const raw = [
    {
      companyName: "LatticeFlow AI",
      domain: "latticeflow.example",
      website: "https://latticeflow.example",
      industry: "Artificial intelligence",
      city: "Bengaluru",
      country: "India",
      employeeCount: 84,
      employeeRange: "51–100",
      revenueRange: "$5M–$10M",
      technologies: ["Next.js", "Python", "OpenRouter"],
      keywords: ["AI", "enterprise"],
      fundingStage: "Series A",
      isHiring: true,
      contactName: "Maya Iyer",
      firstName: "Maya",
      title: "Co-founder & CEO",
      email: "maya@latticeflow.example",
      linkedinUrl: "https://linkedin.com/in/maya-demo",
      sourceUrl: "https://latticeflow.example/about",
      websiteQuality: 91,
    },
    {
      companyName: "Northstar Revenue",
      domain: "northstar.example",
      website: "https://northstar.example",
      industry: "B2B software",
      city: "Mumbai",
      country: "India",
      employeeCount: 132,
      employeeRange: "101–200",
      revenueRange: "$10M–$25M",
      technologies: ["Salesforce", "HubSpot"],
      keywords: ["sales", "automation"],
      fundingStage: "Series B",
      isHiring: true,
      contactName: "Kabir Mehta",
      firstName: "Kabir",
      title: "VP Revenue",
      email: "kabir@northstar.example",
      linkedinUrl: "https://linkedin.com/in/kabir-demo",
      sourceUrl: "https://northstar.example/team",
      websiteQuality: 88,
    },
    {
      companyName: "Cobalt Systems",
      domain: "cobalt.example",
      website: "https://cobalt.example",
      industry: "Enterprise software",
      city: "Pune",
      country: "India",
      employeeCount: 57,
      employeeRange: "51–100",
      revenueRange: "$2M–$5M",
      technologies: ["React", "AWS"],
      keywords: ["workflow", "enterprise"],
      fundingStage: "Seed",
      isHiring: false,
      contactName: "Rhea Shah",
      firstName: "Rhea",
      title: "Founder",
      email: "rhea@cobalt.example",
      linkedinUrl: "https://linkedin.com/in/rhea-demo",
      sourceUrl: "https://cobalt.example/company",
      websiteQuality: 84,
    },
  ];
  void fixtures;
  const provenance = {
    sourceType: "DEMO" as const,
    provider: "athreix-demo",
    collectedAt: new Date().toISOString(),
  };
  const results = raw
    .map((item) => normalizeProspect(item, "B2B", provenance))
    .filter((item): item is NormalizedProspect => Boolean(item))
    .map((item, index) =>
      publicResult(item, searchId, index, {
        query: "AI SaaS founders and revenue leaders in India",
        filters: {},
      }),
    );
  const now = new Date().toISOString();
  return {
    creditBalance: 497,
    creditReserved: 0,
    searches: [
      {
        id: searchId,
        name: "AI companies in India",
        query:
          "Find founders and revenue leaders at AI SaaS companies in India with 20–200 employees",
        mode: "B2B",
        purpose: "Relevant business development for Athreix services",
        filters: {},
        targetCount: 3,
        resultCount: results.length,
        status: "COMPLETE",
        chargedCredits: results.length,
        retentionUntil: new Date(Date.now() + 90 * 86_400_000).toISOString(),
        createdAt: new Date(Date.now() - 86_400_000).toISOString(),
        completedAt: new Date(Date.now() - 86_300_000).toISOString(),
      },
    ],
    jobs: [
      {
        id: "demo-job-b2b",
        searchId,
        status: "COMPLETE",
        stage: "COMPLETE",
        progress: 100,
        provider: "demo",
        createdAt: now,
        completedAt: now,
      },
    ],
    results,
    lists: [
      {
        id: "demo-list-priority",
        name: "Priority accounts",
        description: "Best-fit companies for manual review",
        resultIds: results.slice(0, 2).map((item) => item.id),
        createdAt: now,
        updatedAt: now,
      },
    ],
    exports: [],
    notifications: [
      {
        id: "demo-notification-search",
        type: "SEARCH_COMPLETE",
        title: "Search complete",
        message: `${results.length} prospects are ready to review.`,
        actionUrl: `/results?searchId=${searchId}`,
        createdAt: now,
      },
    ],
    outreach: [],
  };
}

function createLiveInitialState(): DemoState {
  return {
    creditBalance: 500,
    creditReserved: 0,
    searches: [],
    jobs: [],
    results: [],
    lists: [],
    exports: [],
    notifications: [],
    outreach: [],
  };
}

function mergeHistoryById<T extends { id: string }>(
  current: T[],
  persisted: T[],
) {
  const currentIds = new Set(current.map((item) => item.id));
  return [
    ...current,
    ...persisted.filter((item) => !currentIds.has(item.id)),
  ].sort((first, second) => {
    const firstCreatedAt =
      "createdAt" in first && typeof first.createdAt === "string"
        ? first.createdAt
        : "";
    const secondCreatedAt =
      "createdAt" in second && typeof second.createdAt === "string"
        ? second.createdAt
        : "";
    return secondCreatedAt.localeCompare(firstCreatedAt);
  });
}

const existingState = globalDemo.athreixDemo;
const existingStateContainsFixtures = existingState?.results.some(
  (result) => result.normalized.provenance.sourceType === "DEMO",
);
const initialState =
  (env.liveDataOnly && existingStateContainsFixtures
    ? undefined
    : existingState) ??
  (env.liveDataOnly ? createLiveInitialState() : createInitialState());
if (env.liveDataOnly && env.demoMode) {
  const history = existingState
    ? readLocalSearchHistory()
    : prepareLocalHistoryForStartup(readLocalSearchHistory());
  initialState.searches = mergeHistoryById(
    initialState.searches,
    history.searches,
  );
  initialState.jobs = mergeHistoryById(initialState.jobs, history.jobs);
  const liveState = prepareLocalLiveStateForStartup(
    readLocalLiveState(),
    initialState.searches,
  );
  initialState.results = mergeHistoryById(
    initialState.results,
    liveState.results,
  );
  initialState.lists = mergeHistoryById(initialState.lists, liveState.lists);
}
export const demoState = initialState;
globalDemo.athreixDemo = demoState;

export function persistDemoLiveState() {
  if (!env.liveDataOnly || !env.demoMode) return;
  try {
    const retained = prepareLocalLiveStateForStartup(
      {
        updatedAt: new Date().toISOString(),
        results: demoState.results,
        lists: demoState.lists,
      },
      demoState.searches,
    );
    writeLocalLiveState(retained);
  } catch {
    console.warn("Encrypted local search results could not be persisted.");
  }
}

export function persistDemoSearchHistory() {
  if (!env.liveDataOnly || !env.demoMode) return;
  try {
    writeLocalSearchHistory({
      searches: demoState.searches,
      jobs: demoState.jobs,
    });
  } catch {
    console.warn("Local search history could not be persisted.");
  }
  persistDemoLiveState();
}

persistDemoSearchHistory();

export async function createDemoSearch(
  input: SearchInput,
  retentionDays: number,
) {
  if (env.liveDataOnly && input.mode !== "B2B") {
    throw new AppError(
      "LIVE_PROVIDER_MODE_UNAVAILABLE",
      "The configured Apify Actor supports live B2B research only.",
      422,
    );
  }
  if (env.liveDataOnly && !env.b2bActorReady) {
    throw new AppError(
      "APIFY_NOT_CONFIGURED",
      "A reviewed and allowlisted Apify B2B Actor is required for live searches.",
      503,
    );
  }
  if (demoState.creditBalance < input.targetCount) {
    throw new Error("INSUFFICIENT_CREDITS");
  }
  const id = `search-${crypto.randomUUID()}`;
  const jobId = `job-${crypto.randomUUID()}`;
  const now = new Date();
  const search: DemoSearch = {
    id,
    name: input.name ?? input.query.slice(0, 72),
    query: input.query,
    mode: input.mode,
    purpose:
      input.purpose ??
      "Relevant B2B prospect research and manual outreach preparation",
    lawfulBasis: input.lawfulBasis,
    filters: input.filters,
    targetCount: input.targetCount,
    resultCount: 0,
    status: "RUNNING",
    chargedCredits: 0,
    retentionUntil: new Date(
      now.getTime() + retentionDays * 86_400_000,
    ).toISOString(),
    createdAt: now.toISOString(),
  };
  const job: DemoJob = {
    id: jobId,
    searchId: id,
    status: "RUNNING",
    stage: "SEARCHING_COMPANIES",
    progress: 12,
    provider: env.liveDataOnly ? "apify" : "demo",
    createdAt: now.toISOString(),
  };
  demoState.searches.unshift(search);
  demoState.jobs.unshift(job);
  persistDemoSearchHistory();

  const provider = env.liveDataOnly
    ? new ApifyProspectProvider()
    : new DemoProspectProvider();
  const providerTargetCount = candidateCollectionTarget(
    input.targetCount,
    input.filters,
  );
  let providerResult: ProviderResult;
  try {
    providerResult = await provider.search({
      workspaceId: "demo-workspace",
      mode: input.mode,
      query: input.query,
      purpose: search.purpose,
      lawfulBasis: input.lawfulBasis,
      audienceSource: input.audienceSource,
      audienceSourceReference: input.audienceSourceReference,
      jurisdiction: input.jurisdiction,
      filters: input.filters,
      targetCount: providerTargetCount,
    });
  } catch (error) {
    const failedAt = new Date().toISOString();
    Object.assign(search, {
      status: "FAILED",
      completedAt: failedAt,
    });
    Object.assign(job, {
      status: "FAILED",
      stage: "FAILED",
      progress: 100,
      completedAt: failedAt,
    });
    persistDemoSearchHistory();
    throw error;
  }
  const normalized = dedupeProspects(
    providerResult.items
      .map((raw) =>
        normalizeProspect(raw, input.mode, providerResult.provenance),
      )
      .filter((item): item is NormalizedProspect => Boolean(item)),
  ).filter((item) => structuredFilterDecision(item, input.filters).eligible);
  const evaluatedRows = await Promise.all(
    normalized.map(async (item, index) => {
      const deterministic = scoreProspect(item, {
        query: input.query,
        filters: input.filters,
      });
      const analysis = await analyzeProspect({
        item,
        deterministic,
        query: input.query,
        purpose: search.purpose,
        workspaceId: "demo-workspace",
        userId: "demo-user",
      });
      if (!meetsScoreThreshold(analysis.score, input.filters)) return null;
      const base = publicResult(item, id, index, {
        query: input.query,
        filters: input.filters,
      });
      return {
        ...base,
        id: `result-${crypto.randomUUID()}`,
        score: analysis.score,
        buyingIntent: analysis.buyingIntent,
        summary: analysis.summary,
        reasons: analysis.reasons,
        suggestedOffer: analysis.suggestedOffer,
        decisionMakerConfidence: analysis.decisionMakerConfidence,
        recommendedChannel: analysis.recommendedChannel,
      } satisfies PublicProspect;
    }),
  );
  const resultRows = selectTopQualified(
    evaluatedRows.filter((item): item is PublicProspect => Boolean(item)),
    input.targetCount,
  );
  resultRows
    .sort((a, b) => b.score - a.score)
    .forEach((result, index) => (result.rank = index + 1));
  demoState.results.unshift(...resultRows);
  demoState.creditBalance -= resultRows.length;
  Object.assign(search, {
    resultCount: resultRows.length,
    status: "COMPLETE",
    chargedCredits: resultRows.length,
    completedAt: new Date().toISOString(),
  });
  Object.assign(job, {
    status: "COMPLETE",
    stage: "COMPLETE",
    progress: 100,
    completedAt: new Date().toISOString(),
  });
  demoState.notifications.unshift({
    id: `notification-${crypto.randomUUID()}`,
    type: "SEARCH_COMPLETE",
    title: "Search complete",
    message: `${resultRows.length} prospects are ready to review.`,
    actionUrl: `/results?searchId=${id}`,
    createdAt: new Date().toISOString(),
  });
  persistDemoSearchHistory();
  return { search, job, results: resultRows };
}

export function findDemoResult(id: string) {
  return demoState.results.find((result) => result.id === id);
}

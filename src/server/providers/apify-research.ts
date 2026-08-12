import { createHash } from "node:crypto";
import type { ApifyClient } from "apify-client";
import { z } from "zod";
import {
  actorReviewAllows,
  env,
  type ApifyResearchActor,
} from "@/lib/server/env";
import { db } from "@/lib/server/db";
import { AsyncSemaphore } from "@/server/concurrency";
import { removeApifySourceArtifacts } from "@/server/provider-cleanup";
import type {
  ProviderSearchInput,
  RawProspect,
} from "@/server/providers/types";

const researchEvidenceSchema = z
  .object({
    id: z.string(),
    kind: z.enum([
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
    ]),
    title: z.string().optional(),
    excerpt: z.string(),
    sourceUrl: z.string().url().optional(),
    observedAt: z.string().datetime(),
    confidence: z.number().int().min(0).max(100),
    actorId: z.string().optional(),
  })
  .strict();

const researchSignalSchema = z
  .object({
    type: z.enum([
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
    ]),
    title: z.string(),
    detail: z.string(),
    observedAt: z.string().datetime(),
    evidenceRefs: z.array(z.string()),
    confidence: z.number().int().min(0).max(100),
    strength: z.enum(["WEAK", "MODERATE", "STRONG"]),
  })
  .strict();

const researchBundleSchema = z
  .object({
    evidence: z.array(researchEvidenceSchema).max(100),
    signals: z.array(researchSignalSchema).max(50),
    technologies: z.array(z.string()).max(80),
  })
  .strict();

type ResearchBundle = z.infer<typeof researchBundleSchema>;

type CompanyTarget = {
  key: string;
  name: string;
  domain?: string;
  website?: string;
  location?: string;
  industry?: string;
};

const companySemaphore = new AsyncSemaphore(
  env.APIFY_RESEARCH_COMPANY_CONCURRENCY,
);
const actorSemaphore = new AsyncSemaphore(env.APIFY_RESEARCH_ACTOR_CONCURRENCY);
const memoryCache = new Map<
  string,
  { value: ResearchBundle; expiresAt: number }
>();

const evidenceKind: Record<
  ApifyResearchActor["key"],
  ResearchBundle["evidence"][number]["kind"]
> = {
  google_search: "SEARCH",
  google_maps: "MAPS",
  website: "WEBSITE",
  contact: "CONTACT",
  about: "ABOUT",
  services: "SERVICES",
  careers: "CAREERS",
  news: "NEWS",
  company_profile: "PROFILE",
  reviews: "REVIEWS",
  social: "SOCIAL",
};

function stringValue(item: RawProspect, ...keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
}

function companyTarget(item: RawProspect): CompanyTarget | null {
  const name = stringValue(
    item,
    "companyName",
    "organizationName",
    "company",
    "name",
  );
  if (!name) return null;
  const website = stringValue(item, "website", "companyWebsite");
  const domain =
    stringValue(item, "domain", "companyDomain") ??
    (() => {
      try {
        return website ? new URL(website).hostname.replace(/^www\./, "") : "";
      } catch {
        return "";
      }
    })();
  return {
    key: (domain || name).toLowerCase().replace(/\s+/g, "-"),
    name,
    domain: domain || undefined,
    website,
    location: stringValue(item, "companyLocation", "location", "city"),
    industry: stringValue(item, "industry", "companyIndustry"),
  };
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalUrl(value?: string) {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    return /^https?:$/.test(parsed.protocol) ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

function safeExcerpt(value?: string) {
  if (!value) return undefined;
  return value
    .replace(
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
      "[public contact redacted]",
    )
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[public phone redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2_000);
}

function observedAt(item: RawProspect, fallback: string) {
  const candidate = stringValue(
    item,
    "observedAt",
    "publishedAt",
    "date",
    "lastUpdated",
  );
  if (!candidate) return fallback;
  const parsed = new Date(candidate);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : fallback;
}

function arrayStrings(item: RawProspect, ...keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (Array.isArray(value)) {
      return value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .slice(0, 80);
    }
    if (typeof value === "string") {
      return value
        .split(/[,;|]/)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .slice(0, 80);
    }
  }
  return [];
}

function confidenceFor(key: ApifyResearchActor["key"]) {
  if (["website", "about", "services", "careers", "contact"].includes(key))
    return 90;
  if (key === "company_profile") return 86;
  if (key === "news") return 82;
  if (key === "google_maps") return 80;
  return 76;
}

function signalFor(
  actor: ApifyResearchActor,
  evidence: ResearchBundle["evidence"][number],
): ResearchBundle["signals"][number] | null {
  const type =
    actor.key === "careers"
      ? "HIRING"
      : actor.key === "news"
        ? "NEWS"
        : actor.key === "reviews"
          ? "REVIEWS"
          : actor.key === "social"
            ? "SOCIAL"
            : actor.key === "website"
              ? "WEBSITE_CHANGE"
              : actor.key === "services"
                ? "PRODUCT"
                : null;
  if (!type) return null;
  return {
    type,
    title:
      type === "HIRING"
        ? "Public hiring activity"
        : type === "NEWS"
          ? (evidence.title ?? "Recent company news")
          : type === "REVIEWS"
            ? "Public review activity"
            : type === "SOCIAL"
              ? "Public social activity"
              : type === "PRODUCT"
                ? "Service or product signal"
                : "Website activity",
    detail: evidence.excerpt,
    observedAt: evidence.observedAt,
    evidenceRefs: [evidence.id],
    confidence: evidence.confidence,
    strength: evidence.confidence >= 88 ? "STRONG" : "MODERATE",
  };
}

function sanitizeActorItems(
  actor: ApifyResearchActor,
  items: RawProspect[],
  collectedAt: string,
): ResearchBundle {
  const evidence = items
    .slice(0, actor.resultLimit)
    .flatMap((item): ResearchBundle["evidence"] => {
      const sourceUrl = canonicalUrl(
        stringValue(item, "sourceUrl", "url", "link", "website", "profileUrl"),
      );
      const excerpt = safeExcerpt(
        stringValue(
          item,
          "snippet",
          "description",
          "text",
          "content",
          "about",
          "reviewText",
          "title",
          "name",
        ),
      );
      if (!excerpt) return [];
      const id = `ev_${hash(
        `${actor.actorId}:${actor.key}:${sourceUrl ?? ""}:${excerpt}`,
      ).slice(0, 20)}`;
      const title = safeExcerpt(stringValue(item, "title", "name"))?.slice(
        0,
        300,
      );
      return [
        {
          id,
          kind: evidenceKind[actor.key],
          ...(title ? { title } : {}),
          excerpt,
          ...(sourceUrl ? { sourceUrl } : {}),
          observedAt: observedAt(item, collectedAt),
          confidence: confidenceFor(actor.key),
          actorId: actor.actorId,
        } satisfies ResearchBundle["evidence"][number],
      ];
    });
  const signals = evidence
    .map((item) => signalFor(actor, item))
    .filter((value): value is ResearchBundle["signals"][number] =>
      Boolean(value),
    );
  const technologies = Array.from(
    new Set(
      items.flatMap((item) =>
        arrayStrings(
          item,
          "technologies",
          "techStack",
          "technology",
          "frameworks",
          "libraries",
        ),
      ),
    ),
  );
  return { evidence, signals, technologies };
}

function renderTemplate(value: unknown, target: CompanyTarget): unknown {
  const website =
    target.website ?? (target.domain ? `https://${target.domain}` : "");
  const variables: Record<string, string> = {
    "company.name": target.name,
    "company.domain": target.domain ?? "",
    "company.website": website,
    "company.location": target.location ?? "",
    "company.industry": target.industry ?? "",
  };
  if (typeof value === "string") {
    return value.replace(/\{\{([^}]+)\}\}/g, (_match, key: string) => {
      return variables[key.trim()] ?? "";
    });
  }
  if (Array.isArray(value)) {
    return value.map((item) => renderTemplate(item, target));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        renderTemplate(item, target),
      ]),
    );
  }
  return value;
}

function actorInput(actor: ApifyResearchActor, target: CompanyTarget) {
  const fallbackQuery =
    actor.queryTemplate ??
    `{{company.name}} {{company.location}} ${actor.key.replaceAll("_", " ")}`;
  const configured = actor.input ?? {
    query: fallbackQuery,
    maxItems: actor.resultLimit,
  };
  return renderTemplate(configured, target) as Record<string, unknown>;
}

function actorCanRunForTarget(
  actor: ApifyResearchActor,
  target: CompanyTarget,
) {
  if (
    ["website", "contact", "about", "services", "careers"].includes(actor.key)
  ) {
    return Boolean(
      target.website ?? (target.domain ? `https://${target.domain}` : ""),
    );
  }
  return true;
}

function mergeBundles(bundles: ResearchBundle[]): ResearchBundle {
  const evidence = Array.from(
    new Map(
      bundles
        .flatMap((bundle) => bundle.evidence)
        .map((item) => [item.id, item]),
    ).values(),
  ).slice(0, 100);
  const evidenceIds = new Set(evidence.map((item) => item.id));
  const signals = Array.from(
    new Map(
      bundles
        .flatMap((bundle) => bundle.signals)
        .filter((signal) =>
          signal.evidenceRefs.some((reference) => evidenceIds.has(reference)),
        )
        .map((signal) => [
          hash(`${signal.type}:${signal.title}:${signal.observedAt}`),
          signal,
        ]),
    ).values(),
  ).slice(0, 50);
  const technologies = Array.from(
    new Set(bundles.flatMap((bundle) => bundle.technologies)),
  ).slice(0, 80);
  return { evidence, signals, technologies };
}

async function readCache(
  workspaceId: string,
  cacheKey: string,
): Promise<ResearchBundle | null> {
  const memory = memoryCache.get(cacheKey);
  if (memory && memory.expiresAt > Date.now()) return memory.value;
  if (!env.databaseEnabled) return null;
  try {
    const cached = await db.researchCache.findUnique({ where: { cacheKey } });
    if (
      !cached ||
      cached.workspaceId !== workspaceId ||
      cached.expiresAt <= new Date()
    )
      return null;
    const parsed = researchBundleSchema.safeParse(cached.payload);
    if (!parsed.success) return null;
    memoryCache.set(cacheKey, {
      value: parsed.data,
      expiresAt: cached.expiresAt.getTime(),
    });
    return parsed.data;
  } catch {
    return null;
  }
}

async function writeCache(input: {
  workspaceId: string;
  cacheKey: string;
  actor: ApifyResearchActor;
  value: ResearchBundle;
}) {
  const ttlMinutes =
    input.actor.cacheTtlMinutes ?? env.APIFY_RESEARCH_CACHE_TTL_MINUTES;
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
  memoryCache.set(input.cacheKey, {
    value: input.value,
    expiresAt: expiresAt.getTime(),
  });
  if (!env.databaseEnabled) return;
  try {
    await db.researchCache.upsert({
      where: { cacheKey: input.cacheKey },
      create: {
        workspaceId: input.workspaceId,
        cacheKey: input.cacheKey,
        provider: "apify",
        actorId: input.actor.actorId,
        payload: input.value,
        expiresAt,
      },
      update: {
        payload: input.value,
        expiresAt,
      },
    });
  } catch (error) {
    console.warn(
      "Apify research cache write failed",
      error instanceof Error ? error.message : "unknown error",
    );
  }
}

async function runActor(
  client: ApifyClient,
  actor: ApifyResearchActor,
  target: CompanyTarget,
  input: ProviderSearchInput,
): Promise<ResearchBundle> {
  const review = env.actorReviews.find(
    (candidate) => candidate.actorId === actor.actorId,
  );
  if (
    !actor.enabled ||
    !actorCanRunForTarget(actor, target) ||
    !env.actorAllowlist.has(actor.actorId) ||
    !review ||
    !actorReviewAllows(review, {
      mode: "B2B",
      jurisdiction: input.jurisdiction,
      termsVersion: env.APIFY_TERMS_VERSION,
    })
  ) {
    return { evidence: [], signals: [], technologies: [] };
  }
  const cacheKey = hash(
    [
      input.workspaceId,
      actor.actorId,
      actor.build,
      actor.key,
      target.key,
      JSON.stringify(actorInput(actor, target)),
    ].join(":"),
  );
  const cached = await readCache(input.workspaceId, cacheKey);
  if (cached) return cached;

  let lastError: unknown;
  for (let attempt = 0; attempt <= actor.retries; attempt += 1) {
    try {
      const run = await actorSemaphore.run(() =>
        client.actor(actor.actorId).call(actorInput(actor, target), {
          waitSecs: review.timeoutSecs,
          timeout: review.timeoutSecs,
          memory: review.maxMemoryMbytes,
          maxItems: actor.resultLimit,
          maxTotalChargeUsd: review.maxTotalChargeUsd,
          build: actor.build,
          restartOnError: false,
        }),
      );
      if (run.status === "READY" || run.status === "RUNNING") {
        try {
          await client.run(run.id).abort({ gracefully: false });
        } catch {
          // The run may have reached a terminal state between polling and abort.
        }
        throw new Error(`Actor ${actor.key} timed out`);
      }
      if (run.status !== "SUCCEEDED" || !run.defaultDatasetId) {
        throw new Error(`Actor ${actor.key} ended with ${run.status}`);
      }
      const dataset = await client.dataset(run.defaultDatasetId).listItems({
        limit: actor.resultLimit,
        clean: true,
      });
      const value = sanitizeActorItems(
        actor,
        dataset.items as RawProspect[],
        new Date(run.finishedAt ?? Date.now()).toISOString(),
      );
      await writeCache({
        workspaceId: input.workspaceId,
        cacheKey,
        actor,
        value,
      });
      void removeApifySourceArtifacts(client, {
        datasetId: run.defaultDatasetId,
        externalId: run.id,
      });
      return value;
    } catch (error) {
      lastError = error;
    }
  }
  console.warn(
    `Apify research actor ${actor.key} failed`,
    lastError instanceof Error ? lastError.message : "unknown error",
  );
  return { evidence: [], signals: [], technologies: [] };
}

export async function enrichCompaniesWithApifyResearch(
  client: ApifyClient,
  items: RawProspect[],
  input: ProviderSearchInput,
) {
  if (input.mode !== "B2B" || !env.researchActors.length) return items;
  const targets = new Map<string, CompanyTarget>();
  for (const item of items) {
    const target = companyTarget(item);
    if (target && !targets.has(target.key)) targets.set(target.key, target);
  }
  const research = new Map<string, ResearchBundle>();
  await Promise.all(
    [...targets.values()]
      .slice(0, env.APIFY_RESEARCH_COMPANY_LIMIT)
      .map((target) =>
        companySemaphore.run(async () => {
          const bundles = await Promise.all(
            env.researchActors.map((actor) =>
              runActor(client, actor, target, input),
            ),
          );
          research.set(target.key, mergeBundles(bundles));
        }),
      ),
  );
  return items.map((item) => {
    const target = companyTarget(item);
    const bundle = target ? research.get(target.key) : undefined;
    return bundle ? { ...item, _athreixResearch: bundle } : item;
  });
}

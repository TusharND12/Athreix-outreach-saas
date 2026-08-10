import { z } from "zod";

const emptyAsUndefined = (value: unknown) => (value === "" ? undefined : value);
const optionalUrl = z.preprocess(emptyAsUndefined, z.string().url().optional());
const optionalMinimum = (minimum: number) =>
  z.preprocess(emptyAsUndefined, z.string().min(minimum).optional());
const optionalPrefix = (prefix: string) =>
  z.preprocess(emptyAsUndefined, z.string().startsWith(prefix).optional());
const optionalPattern = (pattern: RegExp) =>
  z.preprocess(emptyAsUndefined, z.string().regex(pattern).optional());
const optionalEmail = z.preprocess(
  emptyAsUndefined,
  z.string().email().optional(),
);
const boundedInteger = (
  minimum: number,
  maximum: number,
  defaultValue: number,
) =>
  z.preprocess(
    emptyAsUndefined,
    z.coerce.number().int().min(minimum).max(maximum).default(defaultValue),
  );

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  VERCEL: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().min(1).optional(),
  FIREBASE_STORAGE_BUCKET: z.string().min(1).optional(),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_BASE64: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: optionalEmail,
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().optional(),
  AUTH_URL: optionalUrl,
  AUTH_SECRET: optionalMinimum(32),
  AUTH_TRUST_HOST: z.enum(["true", "false"]).optional(),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  FIELD_ENCRYPTION_KEY: optionalMinimum(32),
  ENCRYPTION_KEY: optionalMinimum(32),
  CLOUD_TASKS_QUEUE: z.string().min(1).default("athreix-search"),
  CLOUD_TASKS_LOCATION: z.string().min(1).default("us-central1"),
  CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL: optionalEmail,
  SEARCH_TASK_TARGET_URL: optionalUrl,
  CLOUD_TASKS_MAX_ATTEMPTS: boundedInteger(1, 10, 3),
  CLOUD_TASKS_DISPATCH_DEADLINE_SECONDS: boundedInteger(60, 1_800, 900),
  SEARCH_TASK_SIGNING_SECRET: optionalMinimum(32),
  APIFY_API_TOKEN: z.string().optional(),
  APIFY_TOKEN: z.string().optional(),
  APIFY_B2B_ACTOR_ID: z.string().optional(),
  APIFY_B2C_ACTOR_ID: z.string().optional(),
  APIFY_ALLOWED_ACTORS: z.string().optional(),
  APIFY_ACTOR_REVIEWS_JSON: z.string().optional(),
  APIFY_B2C_SOURCES_JSON: z.string().optional(),
  APIFY_TERMS_VERSION: z.string().min(1).optional(),
  APIFY_RESEARCH_ACTORS_JSON: z.string().optional(),
  APIFY_RESEARCH_COMPANY_CONCURRENCY: boundedInteger(1, 10, 3),
  APIFY_RESEARCH_ACTOR_CONCURRENCY: boundedInteger(1, 20, 6),
  APIFY_RESEARCH_CACHE_TTL_MINUTES: boundedInteger(5, 10_080, 1_440),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default("openrouter/auto"),
  OPENROUTER_SCORING_MODEL: z.string().default("openrouter/auto"),
  OPENROUTER_OUTREACH_MODEL: z.string().default("openrouter/auto"),
  OPENROUTER_RESEARCH_MODEL: z.string().default("openrouter/auto"),
  OPENROUTER_SCORING_TIMEOUT_MS: boundedInteger(1_000, 120_000, 25_000),
  OPENROUTER_OUTREACH_TIMEOUT_MS: boundedInteger(1_000, 120_000, 30_000),
  OPENROUTER_RESEARCH_TIMEOUT_MS: boundedInteger(1_000, 120_000, 45_000),
  OPENROUTER_SCORING_MAX_RETRIES: boundedInteger(0, 3, 1),
  OPENROUTER_OUTREACH_MAX_RETRIES: boundedInteger(0, 3, 1),
  OPENROUTER_RESEARCH_MAX_RETRIES: boundedInteger(0, 3, 1),
  OPENROUTER_SCORING_CONCURRENCY: boundedInteger(1, 16, 6),
  OPENROUTER_RESEARCH_CONCURRENCY: boundedInteger(1, 12, 4),
  OPENROUTER_ANALYSIS_WINDOW_SIZE: boundedInteger(1, 100, 24),
  OPENROUTER_SITE_NAME: z.string().min(1).max(100).default("Athreix"),
  SEARCH_ANALYSIS_BUDGET_MS: boundedInteger(30_000, 3_600_000, 600_000),
  SEARCH_JOB_HEARTBEAT_INTERVAL_MS: boundedInteger(2_000, 30_000, 10_000),
  SEARCH_JOB_STALE_AFTER_MS: boundedInteger(30_000, 300_000, 90_000),
  CRON_SECRET: optionalMinimum(16),
  EMAIL_SERVER: z.string().optional(),
  EMAIL_FROM: optionalEmail,
  BILLING_PROVIDER: z.enum(["paddle"]).optional(),
  PADDLE_API_KEY: optionalPrefix("pdl_sdbx_apikey_"),
  PADDLE_SANDBOX_API_KEY: optionalPrefix("pdl_sdbx_apikey_"),
  PADDLE_WEBHOOK_SECRET: optionalPrefix("pdl_ntfset_"),
  PADDLE_PRICE_STARTER: optionalPattern(/^pri_[a-z\d]{26}$/),
  PADDLE_PRICE_GROWTH: optionalPattern(/^pri_[a-z\d]{26}$/),
  PADDLE_PRICE_SCALE: optionalPattern(/^pri_[a-z\d]{26}$/),
  NEXT_PUBLIC_PADDLE_ENV: z.enum(["sandbox"]).optional(),
  NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: optionalPattern(/^test_[A-Za-z\d]{27}$/),
  PASSWORD_RESET_TTL_MINUTES: z.preprocess(
    emptyAsUndefined,
    z.coerce.number().int().min(5).max(120).default(30),
  ),
  NEXT_PUBLIC_APP_URL: optionalUrl,
  NEXT_PUBLIC_B2B_JURISDICTION: z.string().trim().min(2).max(100).optional(),
  DEMO_MODE: z.enum(["true", "false"]).optional(),
  NEXT_PUBLIC_DEMO_MODE: z.enum(["true", "false"]).optional(),
  LIVE_DATA_ONLY: z.enum(["true", "false"]).optional(),
  NEXT_PUBLIC_LIVE_DATA_ONLY: z.enum(["true", "false"]).optional(),
  TERMS_VERSION: z.string().min(1).default("2026-07-20"),
  RESPONSIBLE_USE_VERSION: z.string().min(1).default("2026-07-20"),
  ADMIN_EMAILS: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

// Builds and previews must remain renderable before infrastructure is attached.
// Invalid optional values are treated as absent and surfaced by /api/health.
const candidate: Record<string, unknown> = { ...process.env };
if (!parsed.success) {
  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string") delete candidate[key];
  }
}
const raw = parsed.success ? parsed.data : envSchema.parse(candidate);

const actorAllowlist = new Set(
  (raw.APIFY_ALLOWED_ACTORS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

export type ActorReview = {
  actorId: string;
  creator: string;
  reviewedAt: string;
  expiresAt: string;
  termsVersion: string;
  reviewVersion: string;
  modes: Array<"B2B" | "B2C">;
  jurisdictions: string[];
  permissions: string[];
  maxMemoryMbytes: number;
  timeoutSecs: number;
  maxTotalChargeUsd: number;
  approved: boolean;
};

export type ApprovedB2CSource = {
  reference: string;
  audienceSource: "FIRST_PARTY_UPLOAD" | "PERMISSIONED_PARTNER";
  actorId: string;
  sourceOwner: string;
  workspaceIds: string[];
  jurisdictions: string[];
  reviewedAt: string;
  expiresAt: string;
  termsVersion: string;
  approved: boolean;
};

export type ApifyResearchActor = {
  key:
    | "google_search"
    | "google_maps"
    | "website"
    | "contact"
    | "about"
    | "services"
    | "careers"
    | "news"
    | "company_profile"
    | "reviews"
    | "social";
  actorId: string;
  queryTemplate?: string;
  input?: Record<string, unknown>;
  resultLimit: number;
  retries: number;
  cacheTtlMinutes?: number;
  enabled: boolean;
};

function readActorReviews(value?: string): ActorReview[] {
  if (!value) return [];
  try {
    const reviews = z
      .array(
        z
          .object({
            actorId: z.string(),
            creator: z.string().min(1),
            reviewedAt: z.string().datetime(),
            expiresAt: z.string().datetime(),
            termsVersion: z.string().min(1),
            reviewVersion: z.string().min(1),
            modes: z.array(z.enum(["B2B", "B2C"])).min(1),
            jurisdictions: z.array(z.string().min(1)).min(1),
            permissions: z.array(z.string().min(1)),
            maxMemoryMbytes: z.number().int().min(128).max(32_768),
            timeoutSecs: z.number().int().min(30).max(900),
            maxTotalChargeUsd: z.number().positive().max(100),
            approved: z.boolean(),
          })
          .strict(),
      )
      .parse(JSON.parse(value));
    return reviews;
  } catch {
    return [];
  }
}

function readB2CSources(value?: string): ApprovedB2CSource[] {
  if (!value) return [];
  try {
    return z
      .array(
        z
          .object({
            reference: z.string().min(8).max(500),
            audienceSource: z.enum([
              "FIRST_PARTY_UPLOAD",
              "PERMISSIONED_PARTNER",
            ]),
            actorId: z.string().min(1),
            sourceOwner: z.string().min(1),
            workspaceIds: z.array(z.string().min(1)).min(1),
            jurisdictions: z.array(z.string().min(1)).min(1),
            reviewedAt: z.string().datetime(),
            expiresAt: z.string().datetime(),
            termsVersion: z.string().min(1),
            approved: z.boolean(),
          })
          .strict(),
      )
      .parse(JSON.parse(value));
  } catch {
    return [];
  }
}

function readResearchActors(value?: string): ApifyResearchActor[] {
  if (!value) return [];
  try {
    return z
      .array(
        z
          .object({
            key: z.enum([
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
            actorId: z.string().min(1).max(200),
            queryTemplate: z.string().min(1).max(1_000).optional(),
            input: z.record(z.string(), z.unknown()).optional(),
            resultLimit: z.number().int().min(1).max(100).default(10),
            retries: z.number().int().min(0).max(2).default(1),
            cacheTtlMinutes: z.number().int().min(5).max(10_080).optional(),
            enabled: z.boolean().default(true),
          })
          .strict(),
      )
      .max(11)
      .parse(JSON.parse(value));
  } catch {
    return [];
  }
}

function currentWindow(
  reviewedAt: string,
  expiresAt: string,
  now = new Date(),
) {
  const reviewed = new Date(reviewedAt);
  const expires = new Date(expiresAt);
  return (
    Number.isFinite(reviewed.getTime()) &&
    Number.isFinite(expires.getTime()) &&
    reviewed <= now &&
    expires > now
  );
}

export function actorReviewAllows(
  review: ActorReview | undefined,
  input: {
    mode: "B2B" | "B2C";
    jurisdiction?: string;
    termsVersion?: string;
  },
) {
  return Boolean(
    review?.approved &&
    review.creator &&
    review.modes.includes(input.mode) &&
    review.termsVersion === input.termsVersion &&
    currentWindow(review.reviewedAt, review.expiresAt) &&
    (review.jurisdictions.includes("*") ||
      Boolean(
        input.jurisdiction &&
        review.jurisdictions.some(
          (value) => value.toLowerCase() === input.jurisdiction!.toLowerCase(),
        ),
      )),
  );
}

export function approvedB2CSource(
  sources: ApprovedB2CSource[],
  input: {
    reference?: string;
    audienceSource?: "FIRST_PARTY_UPLOAD" | "PERMISSIONED_PARTNER";
    actorId: string;
    workspaceId: string;
    jurisdiction?: string;
    termsVersion?: string;
  },
) {
  return sources.find(
    (source) =>
      source.approved &&
      source.reference === input.reference &&
      source.audienceSource === input.audienceSource &&
      source.actorId === input.actorId &&
      source.workspaceIds.includes(input.workspaceId) &&
      source.termsVersion === input.termsVersion &&
      currentWindow(source.reviewedAt, source.expiresAt) &&
      (source.jurisdictions.includes("*") ||
        Boolean(
          input.jurisdiction &&
          source.jurisdictions.some(
            (value) =>
              value.toLowerCase() === input.jurisdiction!.toLowerCase(),
          ),
        )),
  );
}

const actorReviews = readActorReviews(raw.APIFY_ACTOR_REVIEWS_JSON);
const approvedB2CSources = readB2CSources(raw.APIFY_B2C_SOURCES_JSON);
const researchActors = readResearchActors(raw.APIFY_RESEARCH_ACTORS_JSON);
const apifyToken = raw.APIFY_API_TOKEN ?? raw.APIFY_TOKEN;
const b2bReview = actorReviews.find(
  (review) => review.actorId === raw.APIFY_B2B_ACTOR_ID,
);
const b2cReview = actorReviews.find(
  (review) => review.actorId === raw.APIFY_B2C_ACTOR_ID,
);
const b2bActorReady = Boolean(
  apifyToken &&
  raw.APIFY_B2B_ACTOR_ID &&
  actorAllowlist.has(raw.APIFY_B2B_ACTOR_ID) &&
  actorReviewAllows(b2bReview, {
    mode: "B2B",
    jurisdiction: b2bReview?.jurisdictions[0],
    termsVersion: raw.APIFY_TERMS_VERSION,
  }),
);
const b2cActorReady = Boolean(
  apifyToken &&
  raw.APIFY_B2C_ACTOR_ID &&
  actorAllowlist.has(raw.APIFY_B2C_ACTOR_ID) &&
  actorReviewAllows(b2cReview, {
    mode: "B2C",
    jurisdiction: b2cReview?.jurisdictions[0],
    termsVersion: raw.APIFY_TERMS_VERSION,
  }) &&
  b2cReview?.permissions.some((permission) =>
    ["first_party_data", "permissioned_consumer_data"].includes(
      permission.toLowerCase(),
    ),
  ) &&
  approvedB2CSources.some(
    (source) =>
      source.actorId === raw.APIFY_B2C_ACTOR_ID &&
      source.termsVersion === raw.APIFY_TERMS_VERSION &&
      source.approved &&
      currentWindow(source.reviewedAt, source.expiresAt),
  ),
);
const apifyResearchReady =
  researchActors.length > 0 &&
  researchActors
    .filter((actor) => actor.enabled)
    .every((actor) => {
      const review = actorReviews.find(
        (candidate) => candidate.actorId === actor.actorId,
      );
      return (
        actorAllowlist.has(actor.actorId) &&
        actorReviewAllows(review, {
          mode: "B2B",
          termsVersion: raw.APIFY_TERMS_VERSION,
        })
      );
    });
const platformAdminEmails = new Set(
  (raw.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value && z.string().email().safeParse(value).success),
);

const demoMode =
  raw.DEMO_MODE === "true" ||
  (raw.NODE_ENV !== "production" && !raw.FIREBASE_PROJECT_ID);
const liveDataOnly =
  raw.LIVE_DATA_ONLY === "true" || raw.NEXT_PUBLIC_LIVE_DATA_ONLY === "true";
const billingPriceIds = {
  STARTER: raw.PADDLE_PRICE_STARTER,
  GROWTH: raw.PADDLE_PRICE_GROWTH,
  SCALE: raw.PADDLE_PRICE_SCALE,
} as const;
const configuredBillingPriceIds = Object.values(billingPriceIds).filter(
  (priceId): priceId is string => Boolean(priceId),
);
const paddleApiKey = raw.PADDLE_API_KEY ?? raw.PADDLE_SANDBOX_API_KEY;
const billingReady = Boolean(
  raw.BILLING_PROVIDER === "paddle" &&
  paddleApiKey &&
  raw.PADDLE_WEBHOOK_SECRET &&
  raw.NEXT_PUBLIC_PADDLE_ENV === "sandbox" &&
  raw.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN &&
  configuredBillingPriceIds.length === 3 &&
  new Set(configuredBillingPriceIds).size === 3,
);
const openRouterModelsPinned = [
  raw.OPENROUTER_MODEL,
  raw.OPENROUTER_SCORING_MODEL,
  raw.OPENROUTER_OUTREACH_MODEL,
  raw.OPENROUTER_RESEARCH_MODEL,
].every((model) => Boolean(model && model !== "openrouter/auto"));

function productionAppUrlIsReady(value?: string) {
  if (!value) return false;
  try {
    const parsedUrl = new URL(value);
    return (
      parsedUrl.protocol === "https:" &&
      !["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(
        parsedUrl.hostname.toLowerCase(),
      )
    );
  } catch {
    return false;
  }
}

function productionAuthUrlIsReady(authUrl?: string, publicAppUrl?: string) {
  if (!authUrl || !publicAppUrl || !productionAppUrlIsReady(authUrl))
    return false;
  try {
    return new URL(authUrl).origin === new URL(publicAppUrl).origin;
  } catch {
    return false;
  }
}

export const env = {
  ...raw,
  PADDLE_API_KEY: paddleApiKey,
  FIREBASE_PROJECT_ID: raw.FIREBASE_PROJECT_ID || undefined,
  FIREBASE_STORAGE_BUCKET: raw.FIREBASE_STORAGE_BUCKET || undefined,
  ENCRYPTION_KEY: raw.FIELD_ENCRYPTION_KEY ?? raw.ENCRYPTION_KEY,
  APIFY_TOKEN: raw.APIFY_API_TOKEN ?? raw.APIFY_TOKEN,
  OPENROUTER_MODEL: raw.OPENROUTER_MODEL,
  OPENROUTER_SCORING_MODEL: raw.OPENROUTER_SCORING_MODEL,
  OPENROUTER_OUTREACH_MODEL: raw.OPENROUTER_OUTREACH_MODEL,
  OPENROUTER_RESEARCH_MODEL: raw.OPENROUTER_RESEARCH_MODEL,
  OPENROUTER_RESEARCH_CONCURRENCY: raw.OPENROUTER_RESEARCH_CONCURRENCY,
  SEARCH_JOB_STALE_AFTER_MS: Math.max(
    raw.SEARCH_JOB_STALE_AFTER_MS,
    raw.SEARCH_JOB_HEARTBEAT_INTERVAL_MS * 3,
  ),
  NEXT_PUBLIC_APP_URL: raw.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  AUTH_SECRET:
    raw.AUTH_SECRET ??
    (raw.NODE_ENV === "production"
      ? "athreix-production-auth-secret-not-configured"
      : "athreix-local-demo-secret-change-before-production-2026"),
  actorAllowlist,
  actorReviews,
  approvedB2CSources,
  researchActors,
  platformAdminEmails,
  b2bActorReady,
  b2cActorReady,
  apifyResearchReady,
  emailDeliveryProvider:
    raw.EMAIL_SERVER && raw.EMAIL_FROM
      ? ("smtp" as const)
      : raw.FIREBASE_PROJECT_ID && raw.NEXT_PUBLIC_FIREBASE_API_KEY
        ? ("firebase" as const)
        : undefined,
  emailDeliveryReady: Boolean(
    (raw.EMAIL_SERVER && raw.EMAIL_FROM) ||
    (raw.FIREBASE_PROJECT_ID && raw.NEXT_PUBLIC_FIREBASE_API_KEY),
  ),
  billingProvider: raw.BILLING_PROVIDER,
  billingPriceIds,
  billingReady,
  openRouterModelsPinned,
  firebasePasswordAuthReady: Boolean(
    raw.FIREBASE_PROJECT_ID && raw.NEXT_PUBLIC_FIREBASE_API_KEY,
  ),
  cronReady: Boolean(raw.CRON_SECRET),
  cloudTasksReady: Boolean(
    raw.FIREBASE_PROJECT_ID &&
    raw.CLOUD_TASKS_QUEUE &&
    raw.CLOUD_TASKS_LOCATION &&
    raw.CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL &&
    raw.SEARCH_TASK_TARGET_URL &&
    raw.SEARCH_TASK_SIGNING_SECRET,
  ),
  productionAppUrlReady: productionAppUrlIsReady(raw.NEXT_PUBLIC_APP_URL),
  productionAuthUrlReady: productionAuthUrlIsReady(
    raw.AUTH_URL,
    raw.NEXT_PUBLIC_APP_URL,
  ),
  demoMode,
  liveDataOnly,
  mockDataEnabled: demoMode && !liveDataOnly,
  publicDemoMode:
    raw.NEXT_PUBLIC_DEMO_MODE === "true" && demoMode && !liveDataOnly,
  trustHost:
    raw.AUTH_TRUST_HOST === "true" ||
    (raw.AUTH_TRUST_HOST !== "false" &&
      (raw.DEMO_MODE === "true" ||
        raw.NODE_ENV !== "production" ||
        Boolean(raw.VERCEL))),
  databaseEnabled: Boolean(raw.FIREBASE_PROJECT_ID),
  firebaseEnabled: Boolean(raw.FIREBASE_PROJECT_ID),
  apifyEnabled: Boolean(raw.APIFY_API_TOKEN ?? raw.APIFY_TOKEN),
  openRouterEnabled: Boolean(raw.OPENROUTER_API_KEY),
  authHardened: Boolean(raw.AUTH_SECRET),
  encryptionEnabled: Boolean(raw.FIELD_ENCRYPTION_KEY ?? raw.ENCRYPTION_KEY),
  envValid: parsed.success,
  envIssues: parsed.success
    ? []
    : parsed.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`,
      ),
} as const;

export type ServerEnv = typeof env;

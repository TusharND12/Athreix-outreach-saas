import { NextResponse } from "next/server";
import { databaseIsReachable } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import {
  firebaseAuthIsReachable,
  firebaseStorageIsReachable,
} from "@/lib/server/firebase-admin";
import { billingProviderIsReachable } from "@/lib/server/paddle";
import { queueIsReachable } from "@/server/job-queue";

export async function GET() {
  const [database, authentication, queue, storage, billingProvider] =
    await Promise.all([
      databaseIsReachable(),
      firebaseAuthIsReachable(),
      queueIsReachable(),
      firebaseStorageIsReachable(),
      billingProviderIsReachable(),
    ]);
  const missing = [
    ...(!env.authHardened ? ["AUTH_SECRET"] : []),
    ...(!env.databaseEnabled ? ["FIREBASE_PROJECT_ID"] : []),
    ...(!env.firebasePasswordAuthReady ? ["NEXT_PUBLIC_FIREBASE_API_KEY"] : []),
    ...(!authentication ? ["FIREBASE_AUTHENTICATION"] : []),
    ...(!env.encryptionEnabled ? ["FIELD_ENCRYPTION_KEY"] : []),
    ...(!env.CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL
      ? ["CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL"]
      : []),
    ...(!env.SEARCH_TASK_TARGET_URL ? ["SEARCH_TASK_TARGET_URL"] : []),
    ...(!env.SEARCH_TASK_SIGNING_SECRET ? ["SEARCH_TASK_SIGNING_SECRET"] : []),
    ...(env.cloudTasksReady && !queue ? ["CLOUD_TASKS_QUEUE_ACCESS"] : []),
    ...(!env.apifyEnabled ? ["APIFY_API_TOKEN"] : []),
    ...(!env.APIFY_TERMS_VERSION ? ["APIFY_TERMS_VERSION"] : []),
    ...(!env.b2bActorReady ? ["APIFY_B2B_ACTOR_REVIEW"] : []),
    ...(!env.b2cActorReady && !env.liveDataOnly
      ? ["APIFY_B2C_ACTOR_REVIEW"]
      : []),
    ...(env.billingReady && !billingProvider
      ? ["PADDLE_PRICE_VALIDATION"]
      : []),
    ...(!env.openRouterEnabled ? ["OPENROUTER_API_KEY"] : []),
    ...(env.openRouterEnabled && !env.openRouterModelsPinned
      ? ["OPENROUTER_MODEL_PINNING"]
      : []),
    ...(!env.apifyResearchReady ? ["APIFY_RESEARCH_ACTORS_JSON"] : []),
    ...(!storage ? ["FIREBASE_STORAGE_BUCKET"] : []),
    ...(!env.emailDeliveryReady ? ["AUTH_EMAIL_DELIVERY"] : []),
    ...(!env.billingReady
      ? [
          "BILLING_PROVIDER",
          "PADDLE_API_KEY",
          "PADDLE_WEBHOOK_SECRET",
          "NEXT_PUBLIC_PADDLE_ENV",
          "NEXT_PUBLIC_PADDLE_CLIENT_TOKEN",
          "PADDLE_PRICE_STARTER",
          "PADDLE_PRICE_GROWTH",
          "PADDLE_PRICE_SCALE",
        ]
      : []),
    ...(!env.cronReady ? ["CRON_SECRET"] : []),
    ...(!env.productionAppUrlReady ? ["NEXT_PUBLIC_APP_URL"] : []),
    ...(!env.productionAuthUrlReady ? ["AUTH_URL"] : []),
  ];
  const productionReady =
    env.NODE_ENV !== "production" ||
    (env.envValid &&
      env.authHardened &&
      env.databaseEnabled &&
      env.firebasePasswordAuthReady &&
      database &&
      authentication &&
      env.encryptionEnabled &&
      queue &&
      env.cloudTasksReady &&
      env.b2bActorReady &&
      (env.liveDataOnly || env.b2cActorReady) &&
      env.openRouterEnabled &&
      env.openRouterModelsPinned &&
      env.apifyResearchReady &&
      storage &&
      env.emailDeliveryReady &&
      env.billingReady &&
      billingProvider &&
      env.cronReady &&
      env.productionAppUrlReady &&
      env.productionAuthUrlReady);
  return NextResponse.json(
    {
      status: productionReady ? "ok" : "degraded",
      mode: env.liveDataOnly
        ? env.demoMode
          ? "live_local"
          : "live"
        : env.demoMode
          ? "demo"
          : "configured",
      components: {
        database: database
          ? "up"
          : env.databaseEnabled
            ? "down"
            : "not_configured",
        authentication: authentication
          ? env.firebasePasswordAuthReady
            ? "up"
            : "client_configuration_missing"
          : env.firebaseEnabled
            ? "down"
            : "not_configured",
        authenticationCallbacks: env.productionAuthUrlReady
          ? "canonical_url"
          : env.NODE_ENV === "production"
            ? "unsafe_or_missing"
            : "local",
        queue: queue
          ? "cloud_tasks_ready"
          : env.cloudTasksReady
            ? "down"
            : "not_configured",
        searchWorker: env.cloudTasksReady
          ? "cloud_run_push_target_configured"
          : "not_configured",
        abuseProtection: database ? "firestore" : "unavailable",
        b2bProspectProvider: env.b2bActorReady
          ? "ready"
          : env.mockDataEnabled
            ? "demo"
            : "not_ready",
        b2cProspectProvider: env.b2cActorReady
          ? "ready"
          : env.mockDataEnabled
            ? "demo"
            : "disabled_or_not_reviewed",
        ai:
          env.openRouterEnabled && env.openRouterModelsPinned
            ? "configured_and_pinned"
            : env.openRouterEnabled
              ? "configured_but_unpinned"
              : "deterministic_fallback",
        companyResearch: env.apifyResearchReady
          ? "parallel_actors_ready"
          : env.mockDataEnabled
            ? "demo"
            : "not_ready",
        exportStorage: storage ? "configured" : "not_configured",
        emailDelivery:
          env.emailDeliveryProvider === "smtp"
            ? "smtp"
            : env.emailDeliveryProvider === "firebase"
              ? "firebase_auth"
              : "not_configured",
        paymentProcessing:
          env.billingReady && billingProvider
            ? `${env.billingProvider}_ready`
            : env.billingReady
              ? "provider_or_price_validation_failed"
              : "fail_closed",
        environmentSchema: env.envValid ? "valid" : "invalid",
        retentionCron: env.cronReady ? "configured" : "not_configured",
        publicAppUrl: env.productionAppUrlReady
          ? "production_url"
          : env.NODE_ENV === "production"
            ? "unsafe_or_missing"
            : "local",
        encryption: env.encryptionEnabled
          ? "configured"
          : env.mockDataEnabled
            ? "demo_only"
            : env.liveDataOnly
              ? "local_session_only"
              : "not_configured",
      },
      missingConfiguration: missing,
      timestamp: new Date().toISOString(),
    },
    {
      status: productionReady ? 200 : 503,
      headers: { "cache-control": "no-store" },
    },
  );
}

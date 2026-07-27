import { NextResponse } from "next/server";
import { databaseIsReachable } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import {
  firebaseAuthIsReachable,
  firebaseStorageIsReachable,
} from "@/lib/server/firebase-admin";
import { queueIsReachable, workerIsLive } from "@/server/job-queue";

export async function GET() {
  const [database, authentication, queue, storage] = await Promise.all([
    databaseIsReachable(),
    firebaseAuthIsReachable(),
    queueIsReachable(),
    firebaseStorageIsReachable(),
  ]);
  const worker = queue ? await workerIsLive() : false;
  const missing = [
    ...(!env.authHardened ? ["AUTH_SECRET"] : []),
    ...(!env.databaseEnabled ? ["FIREBASE_PROJECT_ID"] : []),
    ...(!authentication ? ["FIREBASE_AUTHENTICATION"] : []),
    ...(!env.encryptionEnabled ? ["FIELD_ENCRYPTION_KEY"] : []),
    ...(!env.redisEnabled ? ["REDIS_URL"] : []),
    ...(!env.apifyEnabled ? ["APIFY_API_TOKEN"] : []),
    ...(!env.APIFY_TERMS_VERSION ? ["APIFY_TERMS_VERSION"] : []),
    ...(!env.b2bActorReady ? ["APIFY_B2B_ACTOR_REVIEW"] : []),
    ...(!env.b2cActorReady && !env.liveDataOnly
      ? ["APIFY_B2C_ACTOR_REVIEW"]
      : []),
    ...(!env.openRouterEnabled ? ["OPENROUTER_API_KEY"] : []),
    ...(!env.apifyResearchReady ? ["APIFY_RESEARCH_ACTORS_JSON"] : []),
    ...(!storage ? ["FIREBASE_STORAGE_BUCKET"] : []),
    ...(!env.emailDeliveryReady ? ["EMAIL_SERVER", "EMAIL_FROM"] : []),
    ...(!env.cronReady ? ["CRON_SECRET"] : []),
    ...(!env.productionAppUrlReady ? ["NEXT_PUBLIC_APP_URL"] : []),
    ...(!worker ? ["SEARCH_WORKER_HEARTBEAT"] : []),
  ];
  const productionReady =
    env.NODE_ENV !== "production" ||
    (env.authHardened &&
      database &&
      authentication &&
      env.encryptionEnabled &&
      queue &&
      worker &&
      env.b2bActorReady &&
      env.b2cActorReady &&
      env.openRouterEnabled &&
      env.apifyResearchReady &&
      storage &&
      env.emailDeliveryReady &&
      env.cronReady &&
      env.productionAppUrlReady);
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
        authentication: authentication ? "up" : "not_configured",
        queue: queue ? "up" : env.redisEnabled ? "down" : "not_configured",
        searchWorker: worker ? "live" : "no_recent_heartbeat",
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
        ai: env.openRouterEnabled ? "configured" : "deterministic_fallback",
        companyResearch: env.apifyResearchReady
          ? "parallel_actors_ready"
          : env.mockDataEnabled
            ? "demo"
            : "not_ready",
        exportStorage: storage ? "configured" : "not_configured",
        emailDelivery: env.emailDeliveryReady ? "configured" : "not_configured",
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

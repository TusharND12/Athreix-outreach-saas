import { apiRoute, apiSuccess } from "@/lib/server/api";
import { databaseIsReachable } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import {
  firebaseAuthIsReachable,
  firebaseStorageIsReachable,
} from "@/lib/server/firebase-admin";
import { requirePlatformAdmin } from "@/server/auth-context";
import { queueIsReachable } from "@/server/job-queue";

export async function GET() {
  return apiRoute(async () => {
    await requirePlatformAdmin();
    const [database, authentication, storage, queue] = await Promise.all([
      databaseIsReachable(),
      firebaseAuthIsReachable(),
      firebaseStorageIsReachable(),
      queueIsReachable(),
    ]);
    return apiSuccess({
      firestore: database ? "up" : "down",
      authentication: authentication ? "up" : "not_configured",
      storage: storage ? "up" : "not_configured",
      queue: queue
        ? "cloud_tasks_ready"
        : env.cloudTasksReady
          ? "down"
          : "not_configured",
      searchWorker: env.cloudTasksReady
        ? "cloud_run_push_target_configured"
        : "not_configured",
      abuseProtection: database ? "firestore" : "unavailable",
      apifyB2B: env.b2bActorReady ? "ready" : "not_ready",
      apifyB2C: env.b2cActorReady ? "ready" : "disabled_or_not_reviewed",
      openRouter:
        env.openRouterEnabled && env.openRouterModelsPinned
          ? "configured_and_pinned"
          : env.openRouterEnabled
            ? "configured_but_unpinned"
            : "deterministic_fallback",
      apifyResearch: env.apifyResearchReady
        ? "parallel_actors_ready"
        : "not_ready",
      encryption: env.encryptionEnabled ? "configured" : "not_configured",
      environmentValid: env.envValid,
      configurationIssues: env.envIssues,
      timestamp: new Date().toISOString(),
    });
  });
}

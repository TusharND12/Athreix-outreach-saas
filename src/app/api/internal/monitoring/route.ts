import { timingSafeEqual } from "node:crypto";
import { apiRoute, apiSuccess } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import { AppError } from "@/lib/server/errors";

function equalSecret(received: string, expected: string) {
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: Request) {
  return apiRoute(async () => {
    if (!env.databaseEnabled || !env.CRON_SECRET) {
      throw new AppError(
        "MONITORING_NOT_CONFIGURED",
        "Operational monitoring is not configured.",
        503,
      );
    }
    const authorization = request.headers.get("authorization") ?? "";
    const headerSecret = request.headers.get("x-cron-secret") ?? "";
    const candidate = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : headerSecret;
    if (!candidate || !equalSecret(candidate, env.CRON_SECRET)) {
      throw new AppError(
        "UNAUTHORIZED",
        "Invalid monitoring credentials.",
        401,
      );
    }

    const now = new Date();
    const recentWindow = new Date(now.getTime() - 15 * 60 * 1_000);
    const providerCleanupOverdueWindow = new Date(
      now.getTime() - 26 * 60 * 60 * 1_000,
    );
    const staleWindow = new Date(
      now.getTime() -
        Math.max(env.SEARCH_JOB_STALE_AFTER_MS * 2, 5 * 60 * 1_000),
    );
    const [
      recentFailedJobs,
      staleActiveJobs,
      recentFailedExports,
      pastDueSubscriptions,
      overduePrivacyRequests,
      providerCleanupBacklog,
    ] = await Promise.all([
      db.searchJob.count({
        where: { status: "FAILED", completedAt: { gte: recentWindow } },
      }),
      db.searchJob.count({
        where: {
          status: { in: ["QUEUED", "RUNNING", "RETRYING"] },
          updatedAt: { lt: staleWindow },
        },
      }),
      db.export.count({
        where: { status: "FAILED", updatedAt: { gte: recentWindow } },
      }),
      db.subscription.count({ where: { status: "PAST_DUE" } }),
      db.dataSubjectRequest.count({
        where: {
          status: { in: ["RECEIVED", "VERIFYING", "IN_PROGRESS"] },
          dueAt: { lt: now },
        },
      }),
      db.dataSourceRecord.count({
        where: { retentionUntil: { lte: providerCleanupOverdueWindow } },
      }),
    ]);
    const alerts = {
      recentFailedJobs,
      staleActiveJobs,
      recentFailedExports,
      pastDueSubscriptions,
      overduePrivacyRequests,
      providerCleanupBacklog,
    };
    const healthy = Object.values(alerts).every((count) => count === 0);
    return apiSuccess(
      {
        status: healthy ? "ok" : "alert",
        alerts,
        checkedAt: now.toISOString(),
      },
      { status: healthy ? 200 : 503 },
    );
  });
}

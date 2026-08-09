import { apiRoute, apiSuccess } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { requirePlatformAdmin } from "@/server/auth-context";
import { demoState } from "@/server/demo-store";

export async function GET() {
  return apiRoute(async () => {
    const context = await requirePlatformAdmin();
    if (context.demo) {
      return apiSuccess({
        users: 1,
        pendingAccounts: 0,
        workspaces: 1,
        searches: demoState.searches.length,
        failedJobs: 0,
        prospects: demoState.results.length,
        exports: demoState.exports.length,
        creditsConsumed: demoState.searches.reduce(
          (sum, item) => sum + item.chargedCredits,
          0,
        ),
        subscriptions: { STARTER: 0, GROWTH: 1, SCALE: 0 },
      });
    }
    const [
      users,
      pendingAccounts,
      workspaces,
      searches,
      failedJobs,
      prospects,
      exportsCount,
      credits,
      subscriptions,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { approvalStatus: "PENDING" } }),
      db.workspace.count(),
      db.search.count(),
      db.searchJob.count({ where: { status: "FAILED" } }),
      db.searchResult.count(),
      db.export.count(),
      db.creditLedger.aggregate({
        where: { type: "SEARCH_CHARGE" },
        _sum: { amount: true },
      }),
      db.subscription.groupBy({
        by: ["plan"],
        where: { status: { in: ["ACTIVE", "TRIALING"] } },
        _count: true,
      }),
    ]);
    return apiSuccess({
      users,
      pendingAccounts,
      workspaces,
      searches,
      failedJobs,
      prospects,
      exports: exportsCount,
      creditsConsumed: Math.abs(credits._sum.amount ?? 0),
      subscriptions,
    });
  });
}

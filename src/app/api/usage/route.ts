import { apiRoute, apiSuccess } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { requireContext } from "@/server/auth-context";
import { demoState } from "@/server/demo-store";

export async function GET() {
  return apiRoute(async () => {
    const context = await requireContext("VIEWER");
    if (context.demo) {
      return apiSuccess({
        balance: demoState.creditBalance,
        reserved: demoState.creditReserved,
        monthlyCap: 500,
        transactions: demoState.searches.map((search) => ({
          id: `credit-${search.id}`,
          type: "SEARCH_CHARGE",
          amount: -search.chargedCredits,
          referenceId: search.id,
          createdAt: search.createdAt,
        })),
      });
    }
    const [workspace, transactions, usageByCategory] = await Promise.all([
      db.workspace.findUniqueOrThrow({
        where: { id: context.workspaceId },
        select: {
          creditBalance: true,
          creditReserved: true,
          monthlyCreditCap: true,
        },
      }),
      db.creditLedger.findMany({
        where: { workspaceId: context.workspaceId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      db.usageLog.groupBy({
        by: ["category"],
        where: { workspaceId: context.workspaceId },
        _sum: { quantity: true },
      }),
    ]);
    return apiSuccess({
      balance: workspace.creditBalance,
      reserved: workspace.creditReserved,
      monthlyCap: workspace.monthlyCreditCap,
      transactions,
      usageByCategory,
    });
  });
}

import { apiRoute, apiSuccess } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { requirePlatformAdmin } from "@/server/auth-context";
import { demoState } from "@/server/demo-store";

export async function GET() {
  return apiRoute(async () => {
    const context = await requirePlatformAdmin();
    if (context.demo) return apiSuccess(demoState.searches);
    return apiSuccess(
      await db.search.findMany({
        include: {
          workspace: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          jobs: { orderBy: { createdAt: "desc" }, take: 1 },
          _count: { select: { results: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 250,
      }),
    );
  });
}

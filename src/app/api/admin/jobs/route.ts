import { apiRoute, apiSuccess } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { requirePlatformAdmin } from "@/server/auth-context";
import { demoState } from "@/server/demo-store";

export async function GET() {
  return apiRoute(async () => {
    const context = await requirePlatformAdmin();
    if (context.demo) return apiSuccess(demoState.jobs);
    return apiSuccess(
      await db.searchJob.findMany({
        include: {
          search: {
            select: { id: true, name: true, workspaceId: true, mode: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 250,
      }),
    );
  });
}

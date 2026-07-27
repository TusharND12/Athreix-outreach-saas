import { apiRoute, apiSuccess } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { requirePlatformAdmin } from "@/server/auth-context";

export async function GET() {
  return apiRoute(async () => {
    const context = await requirePlatformAdmin();
    if (context.demo) return apiSuccess([]);
    const [jobs, searches] = await Promise.all([
      db.searchJob.findMany({
        where: { status: "FAILED" },
        select: {
          id: true,
          searchId: true,
          errorCode: true,
          errorMessage: true,
          attempt: true,
          completedAt: true,
        },
        orderBy: { completedAt: "desc" },
        take: 200,
      }),
      db.search.findMany({
        where: { status: "FAILED" },
        select: {
          id: true,
          workspaceId: true,
          errorCode: true,
          errorMessage: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 200,
      }),
    ]);
    return apiSuccess({ jobs, searches });
  });
}

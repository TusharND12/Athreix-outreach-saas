import { apiRoute, apiSuccess } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { requirePlatformAdmin } from "@/server/auth-context";
import { readDemoAudit } from "@/server/audit";

export async function GET() {
  return apiRoute(async () => {
    const context = await requirePlatformAdmin();
    if (context.demo) return apiSuccess(readDemoAudit());
    return apiSuccess(
      await db.auditLog.findMany({
        select: {
          id: true,
          workspaceId: true,
          actorId: true,
          action: true,
          entityType: true,
          entityId: true,
          metadata: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
    );
  });
}

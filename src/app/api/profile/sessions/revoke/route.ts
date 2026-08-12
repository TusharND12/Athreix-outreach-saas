import { apiRoute, apiSuccess } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { requireContext } from "@/server/auth-context";
import { writeAudit } from "@/server/audit";

export async function POST() {
  return apiRoute(async () => {
    const context = await requireContext("VIEWER");
    await enforceRateLimit(`sessions:revoke:${context.userId}`, 3, 15 * 60);
    if (!context.demo) {
      await db.user.update({
        where: { id: context.userId },
        data: { sessionVersion: { increment: 1 } },
      });
      await writeAudit({
        workspaceId: context.workspaceId,
        actorId: context.userId,
        action: "account.sessions.revoke_all",
        entityType: "user",
        entityId: context.userId,
      });
    }
    return apiSuccess({ revoked: true });
  });
}

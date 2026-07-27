import { z } from "zod";
import { apiRoute, apiSuccess } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { readJson } from "@/lib/server/errors";
import { requireContext } from "@/server/auth-context";
import { demoState } from "@/server/demo-store";

const patchSchema = z.object({
  ids: z.array(z.string()).max(100).optional(),
  readAll: z.boolean().optional(),
});

export async function GET() {
  return apiRoute(async () => {
    const context = await requireContext("VIEWER");
    if (context.demo) return apiSuccess(demoState.notifications);
    return apiSuccess(
      await db.notification.findMany({
        where: { userId: context.userId, workspaceId: context.workspaceId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    );
  });
}

export async function PATCH(request: Request) {
  return apiRoute(async () => {
    const context = await requireContext("VIEWER");
    const input = patchSchema.parse(await readJson(request));
    const now = new Date();
    if (context.demo) {
      for (const item of demoState.notifications)
        if (input.readAll || input.ids?.includes(item.id))
          item.readAt = now.toISOString();
      return apiSuccess({ ok: true });
    }
    await db.notification.updateMany({
      where: {
        userId: context.userId,
        workspaceId: context.workspaceId,
        ...(input.readAll ? {} : { id: { in: input.ids ?? [] } }),
      },
      data: { readAt: now },
    });
    return apiSuccess({ ok: true });
  });
}

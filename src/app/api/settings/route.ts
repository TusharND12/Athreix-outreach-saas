import { z } from "zod";
import { apiRoute, apiSuccess } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { readJson } from "@/lib/server/errors";
import { requireContext } from "@/server/auth-context";
import { writeAudit } from "@/server/audit";
import { Prisma } from "@prisma/client";

const schema = z.object({
  companyName: z.string().trim().max(120).nullable().optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  emailSignature: z.string().max(2_000).nullable().optional(),
  defaultTone: z
    .enum(["professional", "friendly", "direct", "premium"])
    .optional(),
  defaultFilters: z.record(z.unknown()).nullable().optional(),
  retentionDays: z.number().int().min(30).max(365).optional(),
});

export async function GET() {
  return apiRoute(async () => {
    const context = await requireContext("VIEWER");
    if (context.demo)
      return apiSuccess({
        companyName: "Athreix",
        timezone: "Asia/Kolkata",
        defaultTone: "professional",
        retentionDays: 90,
      });
    return apiSuccess(
      await db.workspace.findUniqueOrThrow({
        where: { id: context.workspaceId },
        select: {
          name: true,
          companyName: true,
          timezone: true,
          emailSignature: true,
          defaultTone: true,
          defaultFilters: true,
          retentionDays: true,
        },
      }),
    );
  });
}

export async function PATCH(request: Request) {
  return apiRoute(async () => {
    const context = await requireContext("ADMIN");
    const input = schema.parse(await readJson(request));
    if (context.demo) return apiSuccess({ ...input, ok: true });
    const workspace = await db.workspace.update({
      where: { id: context.workspaceId },
      data: {
        ...input,
        defaultFilters:
          input.defaultFilters === null
            ? Prisma.DbNull
            : (input.defaultFilters as Prisma.InputJsonValue | undefined),
      },
    });
    await writeAudit({
      workspaceId: context.workspaceId,
      actorId: context.userId,
      action: "workspace.settings.update",
      entityType: "workspace",
      entityId: context.workspaceId,
      metadata: { fields: Object.keys(input) },
    });
    return apiSuccess(workspace);
  });
}

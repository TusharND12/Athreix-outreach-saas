import { z } from "zod";
import { apiRoute, apiSuccess } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { readJson } from "@/lib/server/errors";
import { requireContext } from "@/server/auth-context";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  parentId: z.string().optional(),
});

export async function GET() {
  return apiRoute(async () => {
    const context = await requireContext("VIEWER");
    if (context.demo) return apiSuccess([]);
    return apiSuccess(
      await db.savedFolder.findMany({
        where: { workspaceId: context.workspaceId },
        include: { _count: { select: { lists: true } } },
        orderBy: { name: "asc" },
      }),
    );
  });
}

export async function POST(request: Request) {
  return apiRoute(async () => {
    const context = await requireContext("MEMBER");
    const input = schema.parse(await readJson(request));
    if (context.demo)
      return apiSuccess(
        { id: `folder-${crypto.randomUUID()}`, ...input },
        { status: 201 },
      );
    if (input.parentId) {
      const parent = await db.savedFolder.findFirst({
        where: { id: input.parentId, workspaceId: context.workspaceId },
        select: { id: true },
      });
      if (!parent) {
        throw new (await import("@/lib/server/errors")).AppError(
          "NOT_FOUND",
          "Parent folder not found.",
          404,
        );
      }
    }
    return apiSuccess(
      await db.savedFolder.create({
        data: { workspaceId: context.workspaceId, ...input },
      }),
      { status: 201 },
    );
  });
}

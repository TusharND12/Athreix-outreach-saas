import { z } from "zod";
import { apiRoute, apiSuccess } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { readJson } from "@/lib/server/errors";
import { requireContext } from "@/server/auth-context";

const schema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
});

export async function GET() {
  return apiRoute(async () => {
    const context = await requireContext("VIEWER");
    if (context.demo)
      return apiSuccess({
        id: context.userId,
        name: "Athreix Demo",
        email: "demo@athreix.ai",
        timezone: "Asia/Kolkata",
        role: context.role,
      });
    return apiSuccess(
      await db.user.findUniqueOrThrow({
        where: { id: context.userId },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          timezone: true,
          createdAt: true,
        },
      }),
    );
  });
}

export async function PATCH(request: Request) {
  return apiRoute(async () => {
    const context = await requireContext("VIEWER");
    const input = schema.parse(await readJson(request));
    if (context.demo) return apiSuccess({ id: context.userId, ...input });
    return apiSuccess(
      await db.user.update({
        where: { id: context.userId },
        data: input,
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          timezone: true,
        },
      }),
    );
  });
}

import { z } from "zod";
import { apiRoute, apiSuccess } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { AppError, readJson } from "@/lib/server/errors";
import { requirePlatformAdmin } from "@/server/auth-context";
import { writeAudit } from "@/server/audit";
import { Prisma } from "@prisma/client";

const schema = z.object({
  workspaceId: z.string(),
  amount: z
    .number()
    .int()
    .min(-100_000)
    .max(100_000)
    .refine((value) => value !== 0),
  reason: z.string().trim().min(5).max(500),
  idempotencyKey: z.string().min(8).max(200),
});

export async function POST(request: Request) {
  return apiRoute(async () => {
    const context = await requirePlatformAdmin();
    const input = schema.parse(await readJson(request));
    if (context.demo)
      return apiSuccess({ ok: true, balance: demoStateBalance(input.amount) });
    let result: { creditBalance: number; replayed: boolean };
    try {
      result = await db.$transaction(
        async (tx) => {
          const replay = await tx.creditLedger.findUnique({
            where: { idempotencyKey: input.idempotencyKey },
            select: { workspaceId: true, amount: true, balanceAfter: true },
          });
          if (replay) {
            if (
              replay.workspaceId !== input.workspaceId ||
              replay.amount !== input.amount
            ) {
              throw new AppError(
                "IDEMPOTENCY_CONFLICT",
                "This idempotency key was already used for another adjustment.",
                409,
              );
            }
            return { creditBalance: replay.balanceAfter, replayed: true };
          }
          const current = await tx.workspace.findUnique({
            where: { id: input.workspaceId },
            select: { id: true },
          });
          if (!current) {
            throw new AppError("NOT_FOUND", "Workspace not found.", 404);
          }
          const changed = await tx.workspace.updateMany({
            where: {
              id: input.workspaceId,
              ...(input.amount < 0
                ? { creditBalance: { gte: Math.abs(input.amount) } }
                : {}),
            },
            data: { creditBalance: { increment: input.amount } },
          });
          if (!changed.count) {
            throw new AppError(
              "INVALID_ADJUSTMENT",
              "Credit balance cannot become negative.",
              422,
            );
          }
          const workspace = await tx.workspace.findUniqueOrThrow({
            where: { id: input.workspaceId },
            select: { creditBalance: true },
          });
          await tx.creditLedger.create({
            data: {
              workspaceId: input.workspaceId,
              userId: context.userId,
              type: "ADMIN_ADJUSTMENT",
              amount: input.amount,
              balanceAfter: workspace.creditBalance,
              idempotencyKey: input.idempotencyKey,
              description: input.reason,
            },
          });
          return { creditBalance: workspace.creditBalance, replayed: false };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const replay = await db.creditLedger.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          select: { workspaceId: true, amount: true, balanceAfter: true },
        });
        if (
          replay?.workspaceId === input.workspaceId &&
          replay.amount === input.amount
        ) {
          result = { creditBalance: replay.balanceAfter, replayed: true };
        } else {
          throw new AppError(
            "IDEMPOTENCY_CONFLICT",
            "This idempotency key was already used for another adjustment.",
            409,
          );
        }
      } else {
        throw error;
      }
    }
    await writeAudit({
      workspaceId: input.workspaceId,
      actorId: context.userId,
      action: "credits.adjust",
      entityType: "workspace",
      entityId: input.workspaceId,
      metadata: { amount: input.amount, reason: input.reason },
    });
    return apiSuccess({
      ok: true,
      balance: result.creditBalance,
      replayed: result.replayed,
    });
  });
}

function demoStateBalance(amount: number) {
  // Demo adjustments are intentionally non-persistent across production data.
  return 497 + amount;
}

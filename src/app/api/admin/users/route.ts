import { z } from "zod";
import { apiRoute, apiSuccess, searchParams } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { AppError, readJson } from "@/lib/server/errors";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { requirePlatformAdmin } from "@/server/auth-context";

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  query: z.string().trim().max(120).optional(),
  status: z
    .enum(["ALL", "PENDING", "APPROVED", "REJECTED", "SUSPENDED"])
    .default("ALL"),
});

const mutationSchema = z.object({
  userId: z.string().min(1).max(200),
  action: z.enum(["APPROVE", "REJECT", "SUSPEND", "RESTORE"]),
  note: z.string().trim().max(1_000).optional(),
});

export async function GET(request: Request) {
  return apiRoute(async () => {
    const context = await requirePlatformAdmin();
    const input = listSchema.parse(searchParams(request));
    if (context.demo) {
      const demoUser = {
        id: "demo-user",
        name: "Athreix Demo",
        email: "demo@athreix.ai",
        emailVerified: new Date().toISOString(),
        isPlatformAdmin: true,
        approvalStatus: "APPROVED" as const,
        suspendedAt: null,
        createdAt: new Date().toISOString(),
        workspaces: [
          {
            id: "demo-workspace",
            name: "Athreix Demo",
            role: "OWNER",
            creditBalance: 497,
            plan: "GROWTH",
            subscriptionStatus: "TRIALING",
          },
        ],
        searchCount: 0,
      };
      const matchesQuery = !input.query
        ? true
        : `${demoUser.name} ${demoUser.email}`
            .toLowerCase()
            .includes(input.query.toLowerCase());
      const matchesStatus =
        input.status === "ALL" || input.status === demoUser.approvalStatus;
      const data = matchesQuery && matchesStatus ? [demoUser] : [];
      return apiSuccess(data, {
        meta: {
          pagination: { ...input, total: data.length, pages: 1 },
        },
      });
    }

    const where = {
      ...(input.query
        ? {
            OR: [
              {
                email: { contains: input.query, mode: "insensitive" as const },
              },
              { name: { contains: input.query, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(input.status === "SUSPENDED"
        ? { suspendedAt: { not: null } }
        : input.status !== "ALL"
          ? { approvalStatus: input.status, suspendedAt: null }
          : {}),
    };
    const [users, total] = await db.$transaction([
      db.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          isPlatformAdmin: true,
          approvalStatus: true,
          approvedAt: true,
          approvedById: true,
          rejectedAt: true,
          approvalNote: true,
          suspendedAt: true,
          createdAt: true,
          memberships: {
            where: { isActive: true },
            orderBy: { createdAt: "asc" },
            select: {
              role: true,
              workspace: {
                select: {
                  id: true,
                  name: true,
                  creditBalance: true,
                  subscriptions: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    select: { plan: true, status: true },
                  },
                },
              },
            },
          },
          _count: { select: { searches: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      db.user.count({ where }),
    ]);

    return apiSuccess(
      users.map(({ memberships, _count, approvalStatus, ...user }) => ({
        ...user,
        // Users created before the approval gate are intentionally grandfathered.
        approvalStatus: approvalStatus ?? "APPROVED",
        approvalSource: approvalStatus ? "explicit" : "legacy",
        searchCount: _count.searches,
        workspaces: memberships.map(({ role, workspace }) => ({
          id: workspace.id,
          name: workspace.name,
          role,
          creditBalance: workspace.creditBalance,
          plan: workspace.subscriptions[0]?.plan ?? null,
          subscriptionStatus: workspace.subscriptions[0]?.status ?? null,
        })),
      })),
      {
        meta: {
          pagination: {
            ...input,
            total,
            pages: Math.max(1, Math.ceil(total / input.pageSize)),
          },
        },
      },
    );
  });
}

export async function PATCH(request: Request) {
  return apiRoute(async () => {
    const context = await requirePlatformAdmin();
    const input = mutationSchema.parse(await readJson(request));
    await enforceRateLimit(`admin-users:${context.userId}`, 120, 5 * 60);
    if (context.demo) {
      return apiSuccess({
        ok: true,
        userId: input.userId,
        action: input.action,
      });
    }

    const now = new Date();
    const data =
      input.action === "APPROVE"
        ? {
            approvalStatus: "APPROVED" as const,
            approvedAt: now,
            approvedById: context.userId,
            rejectedAt: null,
            approvalNote: input.note ?? null,
            sessionVersion: { increment: 1 },
          }
        : input.action === "REJECT"
          ? {
              approvalStatus: "REJECTED" as const,
              approvedAt: null,
              approvedById: context.userId,
              rejectedAt: now,
              approvalNote: input.note ?? null,
              sessionVersion: { increment: 1 },
            }
          : input.action === "SUSPEND"
            ? {
                suspendedAt: now,
                sessionVersion: { increment: 1 },
              }
            : {
                suspendedAt: null,
                sessionVersion: { increment: 1 },
              };

    const { updated } = await db.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: input.userId },
        select: {
          id: true,
          email: true,
          emailVerified: true,
          isPlatformAdmin: true,
          approvalStatus: true,
          suspendedAt: true,
          memberships: {
            where: { isActive: true },
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { workspaceId: true },
          },
        },
      });
      if (!target) throw new AppError("NOT_FOUND", "User not found.", 404);
      if (target.isPlatformAdmin) {
        throw new AppError(
          "ADMIN_ACCOUNT_PROTECTED",
          "Platform administrator accounts cannot be changed here.",
          409,
        );
      }
      if (target.id === context.userId) {
        throw new AppError(
          "SELF_ACTION_FORBIDDEN",
          "You cannot change your own access state.",
          409,
        );
      }
      const approvalStatus = target.approvalStatus ?? "APPROVED";
      if (input.action === "APPROVE") {
        if (!target.emailVerified) {
          throw new AppError(
            "EMAIL_NOT_VERIFIED",
            "The user must verify their email before approval.",
            409,
          );
        }
        if (approvalStatus === "APPROVED" || target.suspendedAt) {
          throw new AppError(
            "INVALID_ACCOUNT_TRANSITION",
            "Only a pending or rejected, non-suspended account can be approved.",
            409,
          );
        }
      }
      if (input.action === "REJECT" && approvalStatus !== "PENDING") {
        throw new AppError(
          "INVALID_ACCOUNT_TRANSITION",
          "Only a pending account can be rejected.",
          409,
        );
      }
      if (
        input.action === "SUSPEND" &&
        (approvalStatus !== "APPROVED" || target.suspendedAt)
      ) {
        throw new AppError(
          "INVALID_ACCOUNT_TRANSITION",
          "Only an active approved account can be suspended.",
          409,
        );
      }
      if (input.action === "RESTORE" && !target.suspendedAt) {
        throw new AppError(
          "INVALID_ACCOUNT_TRANSITION",
          "Only a suspended account can be restored.",
          409,
        );
      }

      const updated = await tx.user.update({
        where: { id: target.id },
        data,
        select: {
          id: true,
          approvalStatus: true,
          approvedAt: true,
          rejectedAt: true,
          suspendedAt: true,
          sessionVersion: true,
        },
      });
      const workspaceId =
        target.memberships[0]?.workspaceId ?? context.workspaceId;
      await tx.auditLog.create({
        data: {
          workspaceId,
          actorId: context.userId,
          action: `account.${input.action.toLowerCase()}`,
          entityType: "user",
          entityId: target.id,
          metadata: {
            email: target.email,
            previousApprovalStatus: target.approvalStatus ?? "LEGACY_APPROVED",
            wasSuspended: Boolean(target.suspendedAt),
            note: input.note ?? null,
          },
        },
      });
      return { updated };
    });
    return apiSuccess({ ok: true, user: updated });
  });
}

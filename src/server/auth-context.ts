import { auth } from "@/auth";
import { db } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import { AppError } from "@/lib/server/errors";

export type AppRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

export type RequestContext = {
  userId: string;
  workspaceId: string;
  role: AppRole;
  isPlatformAdmin: boolean;
  demo: boolean;
  mockData: boolean;
};

const roleWeight: Record<AppRole, number> = {
  VIEWER: 0,
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

export async function getRequestContext(): Promise<RequestContext | null> {
  // Explicit demo mode is an isolated fixture runtime even when .env.local also
  // contains a live Firebase project. Never let a demo request touch that project.
  if (env.demoMode) {
    return {
      userId: "demo-user",
      workspaceId: "demo-workspace",
      role: "OWNER",
      isPlatformAdmin: true,
      demo: true,
      mockData: env.mockDataEnabled,
    };
  }
  const session = await auth();
  if (session?.user?.id) {
    if (env.databaseEnabled) {
      const member = await db.workspaceMember.findFirst({
        where: {
          userId: session.user.id,
          isActive: true,
          ...(session.user.workspaceId
            ? { workspaceId: session.user.workspaceId }
            : {}),
        },
        orderBy: { createdAt: "asc" },
        include: {
          user: {
            select: {
              isPlatformAdmin: true,
              suspendedAt: true,
              approvalStatus: true,
            },
          },
        },
      });
      if (member?.user.suspendedAt) {
        throw new AppError(
          "ACCOUNT_SUSPENDED",
          "This account has been suspended.",
          403,
        );
      }
      if (
        member?.user.approvalStatus !== undefined &&
        member.user.approvalStatus !== "APPROVED" &&
        !member.user.isPlatformAdmin
      ) {
        throw new AppError(
          "ACCOUNT_PENDING_APPROVAL",
          "This account is waiting for platform approval.",
          403,
        );
      }
      if (member) {
        return {
          userId: session.user.id,
          workspaceId: member.workspaceId,
          role: member.role,
          isPlatformAdmin: member.user.isPlatformAdmin,
          demo: false,
          mockData: false,
        };
      }
    }
  }
  if (!env.databaseEnabled) {
    throw new AppError(
      "SERVICE_NOT_CONFIGURED",
      "The production data service is not configured.",
      503,
    );
  }
  return null;
}

export async function requireContext(minimumRole: AppRole = "VIEWER") {
  const context = await getRequestContext();
  if (!context) throw new AppError("UNAUTHORIZED", "Sign in to continue.", 401);
  if (roleWeight[context.role] < roleWeight[minimumRole]) {
    throw new AppError(
      "FORBIDDEN",
      "You do not have permission to do that.",
      403,
    );
  }
  return context;
}

export async function requirePlatformAdmin() {
  const context = await requireContext("ADMIN");
  if (!context.isPlatformAdmin) {
    throw new AppError(
      "FORBIDDEN",
      "Platform administrator access is required.",
      403,
    );
  }
  return context;
}

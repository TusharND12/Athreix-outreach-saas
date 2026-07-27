import { db } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import { AppError } from "@/lib/server/errors";
import {
  createFirebasePasswordUser,
  deleteFirebaseUser,
  markFirebaseEmailVerified,
} from "@/lib/server/firebase-auth";

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
  legalAcceptance: {
    termsVersion: string;
    responsibleUseVersion: string;
    accepted: true;
  };
}) {
  if (!env.databaseEnabled) {
    if (!env.demoMode) {
      throw new AppError(
        "SERVICE_NOT_CONFIGURED",
        "Authentication storage is not configured.",
        503,
      );
    }
    return {
      id: "demo-user",
      email: input.email.toLowerCase(),
      demo: true,
      message: "Demo mode is active. Use the demo account to sign in.",
    };
  }

  const email = input.email.trim().toLowerCase();
  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    throw new AppError(
      "ACCOUNT_EXISTS",
      "An account with this email already exists.",
      409,
    );
  }

  const slugBase =
    input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 36) || "workspace";
  const slug = `${slugBase}-${crypto.randomUUID().slice(0, 8)}`;

  const identity = await createFirebasePasswordUser({
    email,
    password: input.password,
    displayName: input.name.trim(),
  });
  try {
    return await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          id: identity.uid,
          name: input.name.trim(),
          email,
          isPlatformAdmin: env.platformAdminEmails.has(email),
        },
      });
      const workspace = await tx.workspace.create({
        data: {
          name: `${input.name.trim()}'s workspace`,
          slug,
          ownerId: user.id,
          creditBalance: 0,
          monthlyCreditCap: 250,
          members: { create: { userId: user.id, role: "OWNER" } },
          subscriptions: { create: { plan: "STARTER", status: "TRIALING" } },
        },
      });
      await tx.auditLog.create({
        data: {
          workspaceId: workspace.id,
          actorId: user.id,
          action: "account.legal_acceptance",
          entityType: "user",
          entityId: user.id,
          metadata: {
            termsVersion: input.legalAcceptance.termsVersion,
            responsibleUseVersion: input.legalAcceptance.responsibleUseVersion,
            acceptedAt: new Date().toISOString(),
          },
        },
      });
      if (env.platformAdminEmails.has(email)) {
        await tx.auditLog.create({
          data: {
            workspaceId: workspace.id,
            actorId: user.id,
            action: "account.platform_admin.bootstrap",
            entityType: "user",
            entityId: user.id,
            metadata: {
              source: "ADMIN_EMAILS",
              grantedAt: new Date().toISOString(),
            },
          },
        });
      }
      return {
        id: user.id,
        email: user.email,
        workspaceId: workspace.id,
        demo: false,
      };
    });
  } catch (error) {
    await deleteFirebaseUser(identity.uid);
    throw error;
  }
}

export async function issueEmailVerification(userId: string, email: string) {
  const rawToken = crypto.randomUUID() + crypto.randomUUID();
  const token = await import("node:crypto").then(({ createHash }) =>
    createHash("sha256").update(rawToken).digest("hex"),
  );
  const identifier = `email:${email.toLowerCase()}`;
  await db.$transaction([
    db.verificationToken.deleteMany({ where: { identifier } }),
    db.verificationToken.create({
      data: {
        identifier,
        token,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    }),
  ]);
  return rawToken;
}

export async function verifyEmailToken(emailValue: string, rawToken: string) {
  const { createHash } = await import("node:crypto");
  const email = emailValue.toLowerCase();
  const identifier = `email:${email}`;
  const token = createHash("sha256").update(rawToken).digest("hex");
  const stored = await db.verificationToken.findUnique({
    where: { identifier_token: { identifier, token } },
  });
  if (!stored) {
    throw new AppError(
      "VERIFICATION_TOKEN_INVALID",
      "This verification link is invalid or has already been used.",
      400,
    );
  }
  if (stored.expires <= new Date()) {
    await db.verificationToken.delete({
      where: { identifier_token: { identifier, token } },
    });
    throw new AppError(
      "VERIFICATION_TOKEN_EXPIRED",
      "This verification link has expired.",
      410,
    );
  }
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError(
      "VERIFICATION_TOKEN_INVALID",
      "This verification link is invalid.",
      400,
    );
  }
  await markFirebaseEmailVerified(user.id);
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date(), sessionVersion: { increment: 1 } },
    });
    const membership = await tx.workspaceMember.findFirst({
      where: { userId: user.id, role: "OWNER", isActive: true },
      include: { workspace: { select: { creditBalance: true } } },
    });
    if (membership) {
      const grantKey = `verification:${user.id}:starter-grant`;
      const existingGrant = await tx.creditLedger.findUnique({
        where: { idempotencyKey: grantKey },
      });
      if (!existingGrant) {
        const workspace = await tx.workspace.update({
          where: { id: membership.workspaceId },
          data: { creditBalance: { increment: 250 } },
        });
        await tx.creditLedger.create({
          data: {
            workspaceId: membership.workspaceId,
            userId: user.id,
            type: "MONTHLY_GRANT",
            amount: 250,
            balanceAfter: workspace.creditBalance,
            idempotencyKey: grantKey,
            description: "Starter credits activated after email verification",
          },
        });
      }
    }
    await tx.verificationToken.delete({
      where: { identifier_token: { identifier, token } },
    });
  });
  return user.id;
}

export async function ensureWorkspaceForUser(
  userId: string,
  name?: string | null,
) {
  if (!env.databaseEnabled) return;
  const existing = await db.workspaceMember.findFirst({ where: { userId } });
  if (existing) return;
  const base = (name ?? "workspace")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 32);
  await db.workspace.create({
    data: {
      name: `${name ?? "My"} workspace`,
      slug: `${base || "workspace"}-${crypto.randomUUID().slice(0, 8)}`,
      ownerId: userId,
      members: { create: { userId, role: "OWNER" } },
      subscriptions: { create: { plan: "STARTER", status: "TRIALING" } },
      creditEntries: {
        create: {
          userId,
          type: "MONTHLY_GRANT",
          amount: 250,
          balanceAfter: 250,
          idempotencyKey: `oauth:${userId}:grant`,
        },
      },
    },
  });
}

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { cookies } from "next/headers";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import {
  resendFirebaseVerificationEmail,
  verifyFirebasePassword,
} from "@/lib/server/firebase-auth";
import {
  ensureWorkspaceForUser,
  synchronizeFirebaseEmailVerification,
} from "@/server/auth-service";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { hashIdentifier } from "@/lib/server/crypto";
import {
  PRIVACY_CONSENT_DATA,
  PRIVACY_CONSENT_PURPOSES,
} from "@/lib/privacy-consent";
import {
  PRIVACY_CONSENT_INTENT_COOKIE,
  verifyPrivacyConsentIntent,
} from "@/lib/server/privacy-consent";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  privacyConsent: z.literal("true"),
  privacyNoticeVersion: z.string().min(1).max(50),
});

async function recordPrivacyConsent(input: {
  userId: string;
  method: "email_signin" | "google_oauth";
  noticeVersion: string;
  ipHash: string;
  userAgent?: string;
  intentId?: string;
}) {
  if (!env.databaseEnabled || input.userId === "demo-user") return;
  const membership = await db.workspaceMember.findFirst({
    where: { userId: input.userId, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { workspaceId: true },
  });
  if (!membership) return;
  await db.auditLog.create({
    data: {
      workspaceId: membership.workspaceId,
      actorId: input.userId,
      action: "account.privacy_consent",
      entityType: "user",
      entityId: input.userId,
      ipHash: input.ipHash,
      userAgent: input.userAgent,
      metadata: {
        method: input.method,
        noticeVersion: input.noticeVersion,
        acceptedAt: new Date().toISOString(),
        dataCategories: PRIVACY_CONSENT_DATA.map((item) => item.id),
        purposes: [...PRIVACY_CONSENT_PURPOSES],
        affirmativeAction: "unchecked_checkbox_selected",
        ...(input.intentId ? { intentId: input.intentId } : {}),
      },
    },
  });
}

const providers = [
  Credentials({
    name: "Email and password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
      privacyConsent: { label: "Privacy consent", type: "text" },
      privacyNoticeVersion: { label: "Privacy notice version", type: "text" },
    },
    async authorize(rawCredentials, request) {
      const parsed = credentialsSchema.safeParse(rawCredentials);
      if (!parsed.success) return null;
      const email = parsed.data.email.toLowerCase();
      if (parsed.data.privacyNoticeVersion !== env.PRIVACY_NOTICE_VERSION) {
        return null;
      }
      if (env.NODE_ENV === "production" && !env.authHardened) return null;
      const forwarded = request.headers
        .get("x-forwarded-for")
        ?.split(",")[0]
        ?.trim();
      const ip = forwarded ?? request.headers.get("x-real-ip") ?? "unknown";
      try {
        await enforceRateLimit(
          `credentials:${hashIdentifier(email)}:${hashIdentifier(ip)}`,
          10,
          15 * 60,
        );
      } catch {
        return null;
      }

      if (env.demoMode) {
        if (
          email === "demo@athreix.ai" &&
          parsed.data.password === "AthreixDemo2026!"
        ) {
          return { id: "demo-user", email, name: "Athreix Demo" };
        }
        return null;
      }

      const identity = await verifyFirebasePassword(
        email,
        parsed.data.password,
      );
      if (!identity) return null;
      let user = await db.user.findUnique({
        where: { id: identity.localId },
      });
      if (user && !user.emailVerified) {
        if (await synchronizeFirebaseEmailVerification(user.id)) {
          user = await db.user.findUnique({ where: { id: identity.localId } });
        } else {
          await resendFirebaseVerificationEmail(identity.idToken).catch(
            () => false,
          );
        }
      }
      if (
        !user ||
        user.suspendedAt ||
        !user.emailVerified ||
        (!user.isPlatformAdmin &&
          user.approvalStatus !== undefined &&
          user.approvalStatus !== "APPROVED")
      )
        return null;
      await recordPrivacyConsent({
        userId: user.id,
        method: "email_signin",
        noticeVersion: parsed.data.privacyNoticeVersion,
        ipHash: hashIdentifier(ip),
        userAgent:
          request.headers.get("user-agent")?.slice(0, 300) ?? undefined,
      });
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        sessionVersion: user.sessionVersion,
      };
    },
  }),
  ...(env.AUTH_GOOGLE_ID &&
  env.AUTH_GOOGLE_SECRET &&
  (env.NODE_ENV !== "production" || env.authHardened)
    ? [
        Google({
          clientId: env.AUTH_GOOGLE_ID,
          clientSecret: env.AUTH_GOOGLE_SECRET,
        }),
      ]
    : []),
];

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: env.AUTH_SECRET,
  trustHost: env.trustHost,
  adapter: env.databaseEnabled ? PrismaAdapter(db) : undefined,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  providers,
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true;
      const cookieStore = await cookies();
      const consent = verifyPrivacyConsentIntent(
        cookieStore.get(PRIVACY_CONSENT_INTENT_COOKIE)?.value,
      );
      return Boolean(consent && user.id);
    },
    async jwt({ token, user }) {
      if (env.NODE_ENV === "production" && !env.authHardened) {
        token.authInvalid = true;
        token.authInvalidReason = "invalid";
        delete token.sub;
        return token;
      }
      if (user?.id) token.sub = user.id;
      if (token.sub === "demo-user" && env.demoMode) {
        token.workspaceId = "demo-workspace";
        token.role = "OWNER";
        token.isPlatformAdmin = true;
        token.authInvalid = false;
        delete token.authInvalidReason;
        return token;
      }
      if (token.sub && env.databaseEnabled) {
        const userState = await db.user.findUnique({
          where: { id: token.sub },
          select: {
            sessionVersion: true,
            suspendedAt: true,
            isPlatformAdmin: true,
            approvalStatus: true,
          },
        });
        if (
          !userState ||
          userState.suspendedAt ||
          (!userState.isPlatformAdmin &&
            userState.approvalStatus !== undefined &&
            userState.approvalStatus !== "APPROVED") ||
          (!user && token.sessionVersion === undefined) ||
          (!user && token.sessionVersion !== userState.sessionVersion)
        ) {
          token.authInvalid = true;
          token.authInvalidReason =
            userState &&
            !userState.isPlatformAdmin &&
            userState.approvalStatus !== undefined &&
            userState.approvalStatus !== "APPROVED"
              ? "approval"
              : userState?.suspendedAt
                ? "suspended"
                : "invalid";
          delete token.sub;
          delete token.workspaceId;
          delete token.role;
          delete token.isPlatformAdmin;
          return token;
        }
        token.sessionVersion = userState.sessionVersion;
        token.authInvalid = false;
        delete token.authInvalidReason;
        const membership = await db.workspaceMember.findFirst({
          orderBy: { createdAt: "asc" },
          where: { userId: token.sub, isActive: true },
          include: { user: { select: { isPlatformAdmin: true } } },
        });
        if (membership) {
          token.workspaceId = membership.workspaceId;
          token.role = membership.role;
          token.isPlatformAdmin = membership.user.isPlatformAdmin;
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.authInvalid ? "" : (token.sub ?? "");
        session.user.workspaceId = token.workspaceId;
        session.user.role = token.role;
        session.user.isPlatformAdmin = token.isPlatformAdmin;
      }
      return session;
    },
  },
  events: {
    async signIn({ user, account }) {
      if (account?.provider !== "google" || !user.id) return;
      const cookieStore = await cookies();
      const consent = verifyPrivacyConsentIntent(
        cookieStore.get(PRIVACY_CONSENT_INTENT_COOKIE)?.value,
      );
      if (!consent) return;
      await ensureWorkspaceForUser(user.id, user.name);
      await recordPrivacyConsent({
        userId: user.id,
        method: "google_oauth",
        noticeVersion: consent.noticeVersion,
        ipHash: consent.ipHash,
        intentId: consent.intentId,
      });
      cookieStore.set({
        name: PRIVACY_CONSENT_INTENT_COOKIE,
        value: "",
        path: "/api/auth",
        maxAge: 0,
      });
    },
    async createUser({ user }) {
      if (user.id) {
        const shouldBootstrapAdmin = Boolean(
          user.email &&
          env.platformAdminEmails.has(user.email.trim().toLowerCase()),
        );
        if (env.databaseEnabled) {
          await db.user.update({
            where: { id: user.id },
            data: {
              emailVerified: new Date(),
              approvalStatus: shouldBootstrapAdmin ? "APPROVED" : "PENDING",
              ...(shouldBootstrapAdmin
                ? {
                    isPlatformAdmin: true,
                    approvedAt: new Date(),
                    approvedById: user.id,
                  }
                : {}),
            },
          });
        }
        await ensureWorkspaceForUser(user.id, user.name);
        if (env.databaseEnabled) {
          const membership = await db.workspaceMember.findFirst({
            where: { userId: user.id, role: "OWNER", isActive: true },
            select: { workspaceId: true },
          });
          if (membership) {
            const existingAcceptance = await db.auditLog.findFirst({
              where: {
                workspaceId: membership.workspaceId,
                actorId: user.id,
                action: "account.legal_acceptance",
                entityType: "user",
                entityId: user.id,
              },
              select: { id: true },
            });
            if (!existingAcceptance) {
              await db.auditLog.create({
                data: {
                  workspaceId: membership.workspaceId,
                  actorId: user.id,
                  action: "account.legal_acceptance",
                  entityType: "user",
                  entityId: user.id,
                  metadata: {
                    method: "oauth_continuation",
                    termsVersion: env.TERMS_VERSION,
                    responsibleUseVersion: env.RESPONSIBLE_USE_VERSION,
                    acceptedAt: new Date().toISOString(),
                  },
                },
              });
            }
            if (shouldBootstrapAdmin) {
              const existingBootstrap = await db.auditLog.findFirst({
                where: {
                  workspaceId: membership.workspaceId,
                  actorId: user.id,
                  action: "account.platform_admin.bootstrap",
                  entityType: "user",
                  entityId: user.id,
                },
                select: { id: true },
              });
              if (!existingBootstrap) {
                await db.auditLog.create({
                  data: {
                    workspaceId: membership.workspaceId,
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
            }
          }
        }
      }
    },
  },
});

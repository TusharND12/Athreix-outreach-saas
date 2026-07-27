import { createHash } from "node:crypto";
import { z } from "zod";
import { apiRoute, apiSuccess } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import { AppError, readJson } from "@/lib/server/errors";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { requestMetadata } from "@/lib/server/request";
import { updateFirebasePassword } from "@/lib/server/firebase-auth";

const schema = z.object({
  token: z.string().min(32).max(256),
  email: z.string().trim().email().max(254),
  password: z
    .string()
    .min(12)
    .max(128)
    .regex(/[a-z]/, "Include a lowercase letter.")
    .regex(/[A-Z]/, "Include an uppercase letter.")
    .regex(/[0-9]/, "Include a number."),
});

export async function POST(request: Request) {
  return apiRoute(async () => {
    const metadata = requestMetadata(request);
    await enforceRateLimit(`password-reset:${metadata.ipHash}`, 8, 15 * 60);
    if (!env.databaseEnabled) {
      throw new AppError(
        "SERVICE_NOT_CONFIGURED",
        "Password reset is unavailable until account storage is configured.",
        503,
      );
    }
    const input = schema.parse(await readJson(request));
    const email = input.email.toLowerCase();
    const identifier = `password:${email}`;
    const token = createHash("sha256").update(input.token).digest("hex");
    const stored = await db.verificationToken.findUnique({
      where: { identifier_token: { identifier, token } },
    });
    if (!stored) {
      throw new AppError(
        "RESET_TOKEN_INVALID",
        "This password reset link is invalid or has already been used.",
        400,
      );
    }
    if (stored.expires <= new Date()) {
      await db.verificationToken.delete({
        where: { identifier_token: { identifier, token } },
      });
      throw new AppError(
        "RESET_TOKEN_EXPIRED",
        "This password reset link has expired. Request a new one.",
        410,
      );
    }
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!user) {
      await db.verificationToken.delete({
        where: { identifier_token: { identifier, token } },
      });
      throw new AppError(
        "RESET_TOKEN_INVALID",
        "This password reset link is invalid or has already been used.",
        400,
      );
    }
    await updateFirebasePassword(user.id, input.password);
    await db.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: user.id },
        data: { passwordHash: null, sessionVersion: { increment: 1 } },
      });
      await transaction.session.deleteMany({ where: { userId: user.id } });
      await transaction.verificationToken.delete({
        where: { identifier_token: { identifier, token } },
      });
    });
    return apiSuccess({
      ok: true,
      message:
        "Your password has been updated. Sign in with your new password.",
    });
  });
}

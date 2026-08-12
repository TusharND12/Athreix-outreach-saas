import { randomBytes, createHash } from "node:crypto";
import { apiRoute, apiSuccess } from "@/lib/server/api";
import { readJson } from "@/lib/server/errors";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { requestMetadata } from "@/lib/server/request";
import { db } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import { z } from "zod";
import nodemailer from "nodemailer";
import { sendFirebasePasswordResetEmail } from "@/lib/server/firebase-auth";

const schema = z.object({ email: z.string().trim().email().max(254) });

export async function POST(request: Request) {
  return apiRoute(async () => {
    const metadata = requestMetadata(request);
    await enforceRateLimit(`forgot:${metadata.ipHash}`, 5, 15 * 60);
    const { email } = schema.parse(await readJson(request));
    const normalized = email.toLowerCase();
    const rawToken = randomBytes(32).toString("base64url");
    const resetUrl = new URL("/reset-password", env.NEXT_PUBLIC_APP_URL);
    resetUrl.searchParams.set("token", rawToken);
    resetUrl.searchParams.set("email", normalized);
    if (env.databaseEnabled) {
      const user = await db.user.findUnique({
        where: { email: normalized },
        select: { id: true },
      });
      if (user) {
        if (
          (env.EMAIL_SERVER && env.EMAIL_FROM) ||
          env.NODE_ENV !== "production"
        ) {
          const token = createHash("sha256").update(rawToken).digest("hex");
          await db.verificationToken.deleteMany({
            where: { identifier: `password:${normalized}` },
          });
          await db.verificationToken.create({
            data: {
              identifier: `password:${normalized}`,
              token,
              expires: new Date(
                Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60 * 1000,
              ),
            },
          });
        }
        if (env.EMAIL_SERVER && env.EMAIL_FROM) {
          try {
            const transport = nodemailer.createTransport(env.EMAIL_SERVER);
            await transport.sendMail({
              from: env.EMAIL_FROM,
              to: normalized,
              subject: "Reset your Athreix password",
              text: `Reset your Athreix password using this link (valid for ${env.PASSWORD_RESET_TTL_MINUTES} minutes): ${resetUrl.toString()}`,
              html: `<p>Reset your Athreix password using the link below. It is valid for ${env.PASSWORD_RESET_TTL_MINUTES} minutes.</p><p><a href="${resetUrl.toString()}">Reset password</a></p><p>If you did not request this, you can ignore this message.</p>`,
            });
          } catch (error) {
            console.warn(
              "Password reset email delivery failed",
              error instanceof Error ? error.message : "unknown mail error",
            );
          }
        } else if (env.NODE_ENV === "production") {
          await sendFirebasePasswordResetEmail(normalized).catch(() => false);
        }
      }
    }
    return apiSuccess(
      {
        ok: true,
        message:
          "If an account exists for that address, password reset instructions will be sent.",
      },
      {
        meta:
          env.NODE_ENV !== "production"
            ? { localResetPath: `${resetUrl.pathname}${resetUrl.search}` }
            : undefined,
      },
    );
  });
}

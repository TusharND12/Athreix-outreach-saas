import nodemailer from "nodemailer";
import { z } from "zod";
import { apiRoute, apiSuccess } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import { readJson } from "@/lib/server/errors";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { requestMetadata } from "@/lib/server/request";
import { issueEmailVerification } from "@/server/auth-service";

const schema = z.object({ email: z.string().trim().email().max(254) });

export async function POST(request: Request) {
  return apiRoute(async () => {
    const metadata = requestMetadata(request);
    await enforceRateLimit(
      `resend-verification:${metadata.ipHash}`,
      5,
      15 * 60,
    );
    const { email: rawEmail } = schema.parse(await readJson(request));
    const email = rawEmail.toLowerCase();
    let localVerificationPath: string | undefined;
    // Default to an accepted/sent-shaped response to avoid account enumeration.
    // For a real unverified account, SMTP failure is reported as pending_retry.
    let deliveryStatus: "sent" | "pending_retry" | "local" = "sent";
    if (env.databaseEnabled) {
      const user = await db.user.findUnique({
        where: { email },
        select: { id: true, emailVerified: true },
      });
      if (user && !user.emailVerified) {
        const token = await issueEmailVerification(user.id, email);
        const verifyUrl = new URL("/verify-email", env.NEXT_PUBLIC_APP_URL);
        verifyUrl.searchParams.set("token", token);
        verifyUrl.searchParams.set("email", email);
        if (env.EMAIL_SERVER && env.EMAIL_FROM) {
          try {
            await nodemailer.createTransport(env.EMAIL_SERVER).sendMail({
              from: env.EMAIL_FROM,
              to: email,
              subject: "Verify your Athreix account",
              text: `Verify your Athreix account within 24 hours: ${verifyUrl.toString()}`,
              html: `<p><a href="${verifyUrl.toString()}">Verify your Athreix account</a>. This link is valid for 24 hours.</p>`,
            });
          } catch (error) {
            deliveryStatus = "pending_retry";
            console.warn(
              "Verification email redelivery failed",
              error instanceof Error ? error.message : "unknown mail error",
            );
          }
        } else if (env.NODE_ENV !== "production") {
          localVerificationPath = `${verifyUrl.pathname}${verifyUrl.search}`;
          deliveryStatus = "local";
        }
      }
    }
    return apiSuccess(
      {
        ok: true,
        message:
          "If an unverified account exists, verification delivery has been accepted. If it does not arrive, wait a minute and retry.",
        verification: {
          deliveryStatus,
          resendEndpoint: "/api/auth/resend-verification",
        },
        retryAfterSeconds: deliveryStatus === "pending_retry" ? 60 : undefined,
      },
      {
        status: 202,
        meta: localVerificationPath ? { localVerificationPath } : undefined,
      },
    );
  });
}

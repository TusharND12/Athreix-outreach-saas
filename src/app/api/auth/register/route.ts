import { apiRoute, apiSuccess } from "@/lib/server/api";
import { readJson } from "@/lib/server/errors";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { requestMetadata } from "@/lib/server/request";
import { registerSchema } from "@/server/schemas";
import { registerUser } from "@/server/auth-service";
import { issueEmailVerification } from "@/server/auth-service";
import { env } from "@/lib/server/env";
import { AppError } from "@/lib/server/errors";
import nodemailer from "nodemailer";
import { sendFirebaseVerificationEmail } from "@/lib/server/firebase-auth";

export async function POST(request: Request) {
  return apiRoute(async () => {
    const metadata = requestMetadata(request);
    await enforceRateLimit(`register:${metadata.ipHash}`, 5, 15 * 60);
    const input = registerSchema.parse(await readJson(request));
    if (
      input.legalAcceptance.termsVersion !== env.TERMS_VERSION ||
      input.legalAcceptance.responsibleUseVersion !==
        env.RESPONSIBLE_USE_VERSION ||
      input.privacyConsent.noticeVersion !== env.PRIVACY_NOTICE_VERSION
    ) {
      throw new AppError(
        "LEGAL_VERSION_OUTDATED",
        "Review and accept the current Terms, Responsible Use Policy, and Privacy Notice.",
        409,
      );
    }
    const user = await registerUser({ ...input, consentEvidence: metadata });
    let localVerificationPath: string | undefined;
    let deliveryStatus: "sent" | "pending_retry" | "local" | "demo" = user.demo
      ? "demo"
      : "pending_retry";
    if (!user.demo && user.email) {
      if (env.EMAIL_SERVER && env.EMAIL_FROM) {
        const token = await issueEmailVerification(user.id, user.email);
        const verifyUrl = new URL("/verify-email", env.NEXT_PUBLIC_APP_URL);
        verifyUrl.searchParams.set("token", token);
        verifyUrl.searchParams.set("email", user.email);
        try {
          const transport = nodemailer.createTransport(env.EMAIL_SERVER);
          await transport.sendMail({
            from: env.EMAIL_FROM,
            to: user.email,
            subject: "Verify your Athreix account",
            text: `Verify your Athreix account within 24 hours: ${verifyUrl.toString()}`,
            html: `<p>Verify your Athreix account within 24 hours.</p><p><a href="${verifyUrl.toString()}">Verify email</a></p>`,
          });
          deliveryStatus = "sent";
        } catch (error) {
          console.warn(
            "Verification email delivery failed",
            error instanceof Error ? error.message : "unknown mail error",
          );
        }
      } else if (env.NODE_ENV === "production") {
        try {
          deliveryStatus = (await sendFirebaseVerificationEmail(
            user.email,
            input.password,
          ))
            ? "sent"
            : "pending_retry";
        } catch (error) {
          console.warn(
            "Firebase verification email delivery failed",
            error instanceof Error ? error.message : "unknown mail error",
          );
        }
      } else {
        const token = await issueEmailVerification(user.id, user.email);
        const verifyUrl = new URL("/verify-email", env.NEXT_PUBLIC_APP_URL);
        verifyUrl.searchParams.set("token", token);
        verifyUrl.searchParams.set("email", user.email);
        localVerificationPath = `${verifyUrl.pathname}${verifyUrl.search}`;
        deliveryStatus = "local";
      }
    }
    return apiSuccess(
      {
        ok: true,
        user: { id: user.id, email: user.email },
        verification: {
          deliveryStatus,
          resendEndpoint: "/api/auth/resend-verification",
        },
        message:
          deliveryStatus === "pending_retry"
            ? "Account created, but the verification email could not be delivered. Use resend verification to try again."
            : "Account created. Verify your email, then wait for platform approval before signing in.",
      },
      {
        status: deliveryStatus === "pending_retry" ? 202 : 201,
        meta: localVerificationPath ? { localVerificationPath } : undefined,
      },
    );
  });
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import * as React from "react";
import { useForm } from "react-hook-form";
import { CheckCircle2, Mail, RefreshCw, TriangleAlert } from "lucide-react";
import { z } from "zod";

import { FormField, PasswordField } from "@/components/auth/form-field";
import { DataProcessingConsent } from "@/components/auth/data-processing-consent";
import { OAuthSection } from "@/components/auth/oauth-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter your full name.")
    .max(80, "Keep your name under 80 characters."),
  email: z.string().trim().email("Enter a valid work email address."),
  password: z
    .string()
    .min(12, "Use at least 12 characters.")
    .regex(/[a-z]/, "Add a lowercase letter.")
    .regex(/[A-Z]/, "Add an uppercase letter.")
    .regex(/[0-9]/, "Add a number."),
  accepted: z
    .boolean()
    .refine(
      (value) => value,
      "Accept the Terms and Responsible Use Policy to continue.",
    ),
  privacyConsent: z
    .boolean()
    .refine(
      (value) => value,
      "Give data-processing consent to create or access an account.",
    ),
});

type SignupValues = z.infer<typeof schema>;

export function SignupForm({
  termsVersion,
  responsibleUseVersion,
  privacyNoticeVersion,
  demoMode = false,
}: {
  termsVersion: string;
  responsibleUseVersion: string;
  privacyNoticeVersion: string;
  demoMode?: boolean;
}) {
  const [formError, setFormError] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState<{
    email: string;
    localVerificationPath?: string;
    deliveryStatus: "sent" | "pending_retry" | "local" | "demo";
  } | null>(null);
  const [resending, setResending] = React.useState(false);
  const [resendMessage, setResendMessage] = React.useState<string | null>(null);
  const [resendError, setResendError] = React.useState<string | null>(null);
  const verificationPassword = React.useRef("");
  const {
    register,
    handleSubmit,
    setValue,
    trigger,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      accepted: false,
      privacyConsent: false,
    },
  });
  const accepted = watch("accepted");
  const privacyConsent = watch("privacyConsent");

  const prepareGoogleConsent = async () => {
    setFormError(null);
    if (!(await trigger("privacyConsent"))) return false;
    try {
      const response = await fetch("/api/auth/privacy-consent-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noticeVersion: privacyNoticeVersion,
          accepted: true,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setFormError(
          payload?.error?.message ??
            "Data-processing consent could not be recorded. Try again.",
        );
        return false;
      }
      return true;
    } catch {
      setFormError("Data-processing consent could not be recorded. Try again.");
      return false;
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name.trim(),
          email: values.email.trim(),
          password: values.password,
          legalAcceptance: {
            termsVersion,
            responsibleUseVersion,
            accepted: true,
          },
          privacyConsent: {
            noticeVersion: privacyNoticeVersion,
            accepted: true,
          },
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        data?: {
          message?: string;
          verification?: {
            deliveryStatus?: "sent" | "pending_retry" | "local" | "demo";
          };
        };
        error?: { message?: string };
        meta?: { localVerificationPath?: string };
      } | null;

      if (!response.ok) {
        setFormError(
          payload?.error?.message ??
            payload?.data?.message ??
            "We couldn’t create the account. Review your details and try again.",
        );
        return;
      }

      setCreated({
        email: values.email.trim(),
        localVerificationPath: payload?.meta?.localVerificationPath,
        deliveryStatus:
          payload?.data?.verification?.deliveryStatus ??
          (demoMode ? "demo" : "sent"),
      });
      verificationPassword.current = values.password;
    } catch {
      setFormError(
        "Account creation is temporarily unavailable. Please try again in a moment.",
      );
    }
  });

  const resendVerification = async () => {
    if (!created) return;
    setResending(true);
    setResendMessage(null);
    setResendError(null);
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: created.email,
          password: verificationPassword.current,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        data?: {
          message?: string;
          verification?: {
            deliveryStatus?: "sent" | "pending_retry" | "local";
          };
          retryAfterSeconds?: number;
        };
        error?: { message?: string };
        meta?: { localVerificationPath?: string };
      } | null;
      if (!response.ok) {
        throw new Error(
          payload?.error?.message ??
            "The verification email could not be retried yet.",
        );
      }
      const deliveryStatus = payload?.data?.verification?.deliveryStatus;
      setCreated((current) =>
        current
          ? {
              ...current,
              deliveryStatus: deliveryStatus ?? current.deliveryStatus,
              localVerificationPath:
                payload?.meta?.localVerificationPath ??
                current.localVerificationPath,
            }
          : current,
      );
      if (deliveryStatus === "pending_retry") {
        setResendError(
          `Email delivery is still unavailable. Wait ${payload?.data?.retryAfterSeconds ?? 60} seconds, then retry.`,
        );
      } else {
        setResendMessage(
          payload?.data?.message ??
            "Verification requested. Check your inbox and spam folder.",
        );
      }
    } catch (error) {
      setResendError(
        error instanceof Error
          ? error.message
          : "The verification email could not be retried yet.",
      );
    } finally {
      setResending(false);
    }
  };

  if (created) {
    const deliveryPending = created.deliveryStatus === "pending_retry";
    return (
      <div>
        <Alert
          variant={deliveryPending ? "warning" : "success"}
          className="p-5"
        >
          {deliveryPending ? (
            <TriangleAlert aria-hidden="true" />
          ) : (
            <CheckCircle2 aria-hidden="true" />
          )}
          <div>
            <p className="font-semibold">
              {demoMode
                ? "Preview account recorded"
                : deliveryPending
                  ? "Account created—email delivery needs a retry"
                  : "Verify your email"}
            </p>
            <AlertDescription>
              {demoMode
                ? "Demo signups are not persisted. Continue with the preconfigured demo account to explore the workspace."
                : deliveryPending
                  ? `We could not deliver the verification email to ${created.email}. Your account remains inactive until email verification and platform approval are complete.`
                  : `We sent a verification link to ${created.email}. After verification, a platform administrator will review the account before workspace access is enabled.`}
            </AlertDescription>
          </div>
        </Alert>
        {deliveryPending ? (
          <Button
            type="button"
            variant="outline"
            className="mt-4 w-full"
            loading={resending}
            onClick={() => void resendVerification()}
          >
            <RefreshCw aria-hidden="true" />
            Retry verification email
          </Button>
        ) : null}
        {resendMessage ? (
          <Alert variant="info" className="mt-4">
            <Mail aria-hidden="true" />
            <AlertDescription>{resendMessage}</AlertDescription>
          </Alert>
        ) : null}
        {resendError ? (
          <Alert variant="error" className="mt-4">
            <TriangleAlert aria-hidden="true" />
            <AlertDescription>{resendError}</AlertDescription>
          </Alert>
        ) : null}
        {created.localVerificationPath ? (
          <Alert className="mt-4">
            <Mail aria-hidden="true" />
            <AlertDescription>
              Local email delivery is not configured. Use the development-only{" "}
              <Link
                href={created.localVerificationPath}
                className="font-semibold text-foreground underline underline-offset-3"
              >
                verification link
              </Link>
              .
            </AlertDescription>
          </Alert>
        ) : null}
        <Button asChild className="mt-6 w-full">
          <Link href="/login">
            {demoMode ? "Continue to demo sign in" : "Back to sign in"}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <DataProcessingConsent
        id="signup-privacy-consent"
        checked={privacyConsent}
        noticeVersion={privacyNoticeVersion}
        error={errors.privacyConsent?.message}
        onCheckedChange={(checked) =>
          setValue("privacyConsent", checked, { shouldValidate: true })
        }
      />
      <OAuthSection
        label="Sign up with Google"
        onBeforeSignIn={prepareGoogleConsent}
        consentNotice={
          <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">
            By continuing with Google, you agree to the{" "}
            <Link
              href="/terms"
              className="font-semibold text-foreground underline underline-offset-3"
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              href="/responsible-use"
              className="font-semibold text-foreground underline underline-offset-3"
            >
              Responsible Use Policy
            </Link>
            .
          </p>
        }
      />
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {formError ? (
          <Alert variant="error">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}
        <FormField
          label="Full name"
          autoComplete="name"
          placeholder="Your name"
          error={errors.name?.message}
          {...register("name")}
        />
        <FormField
          label="Work email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          error={errors.email?.message}
          {...register("email")}
        />
        <PasswordField
          label="Password"
          autoComplete="new-password"
          placeholder="Create a secure password"
          hint="12+ characters with uppercase, lowercase, and a number."
          error={errors.password?.message}
          {...register("password")}
        />
        <div>
          <div className="flex items-start gap-3">
            <Checkbox
              id="accepted"
              checked={accepted}
              onCheckedChange={(checked) =>
                setValue("accepted", checked === true, { shouldValidate: true })
              }
              aria-invalid={Boolean(errors.accepted)}
              aria-describedby={errors.accepted ? "accepted-error" : undefined}
            />
            <Label
              htmlFor="accepted"
              className="text-xs leading-5 text-muted-foreground"
            >
              I agree to the{" "}
              <Link
                href="/terms"
                className="font-semibold text-foreground underline underline-offset-3"
              >
                Terms
              </Link>{" "}
              and{" "}
              <Link
                href="/responsible-use"
                className="font-semibold text-foreground underline underline-offset-3"
              >
                Responsible Use Policy
              </Link>
              .
            </Label>
          </div>
          {errors.accepted ? (
            <p
              id="accepted-error"
              className="mt-2 text-xs font-medium text-destructive"
            >
              {errors.accepted.message}
            </p>
          ) : null}
        </div>
        <Button type="submit" className="w-full" loading={isSubmitting}>
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="mt-7 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}

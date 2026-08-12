"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { FormField, PasswordField } from "@/components/auth/form-field";
import { DataProcessingConsent } from "@/components/auth/data-processing-consent";
import { OAuthSection } from "@/components/auth/oauth-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
  privacyConsent: z
    .boolean()
    .refine((value) => value, "Give data-processing consent to sign in."),
});

type LoginValues = z.infer<typeof schema>;

export function LoginForm({
  callbackUrl = "/search",
  privacyNoticeVersion,
  demoCredentials,
  accountCreated = false,
  emailVerified = false,
  pendingApproval = false,
  consentWithdrawn = false,
}: {
  callbackUrl?: string;
  privacyNoticeVersion: string;
  demoCredentials?: { email: string; password: string };
  accountCreated?: boolean;
  emailVerified?: boolean;
  pendingApproval?: boolean;
  consentWithdrawn?: boolean;
}) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);
  const safeCallback =
    callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
      ? callbackUrl
      : "/search";
  const {
    register,
    handleSubmit,
    setValue,
    trigger,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", privacyConsent: false },
  });
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
      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        privacyConsent: "true",
        privacyNoticeVersion,
        redirect: false,
      });

      if (!result || result.error) {
        setFormError(
          "We couldn’t sign you in with those details. Check them and try again.",
        );
        return;
      }

      router.push(safeCallback);
      router.refresh();
    } catch {
      setFormError(
        "Sign-in is temporarily unavailable. Please try again in a moment.",
      );
    }
  });

  return (
    <>
      {accountCreated ? (
        <Alert variant="success" className="mb-5">
          <AlertDescription>
            Your account is ready. Sign in to continue.
          </AlertDescription>
        </Alert>
      ) : null}
      {emailVerified ? (
        <Alert variant="info" className="mb-5">
          <AlertDescription>
            Email verified. Your account will be available after platform
            approval; try signing in once your review is complete.
          </AlertDescription>
        </Alert>
      ) : null}
      {pendingApproval ? (
        <Alert variant="info" className="mb-5">
          <AlertDescription>
            Your email is verified and the account is waiting for platform
            approval. Access will remain closed until an administrator approves
            it.
          </AlertDescription>
        </Alert>
      ) : null}
      {consentWithdrawn ? (
        <Alert variant="info" className="mb-5">
          <AlertDescription>
            Your data-processing consent was withdrawn, application sessions
            were revoked, and a restriction request was recorded. Contact
            tech@athreix.com if you need help.
          </AlertDescription>
        </Alert>
      ) : null}
      <DataProcessingConsent
        id="login-privacy-consent"
        checked={privacyConsent}
        noticeVersion={privacyNoticeVersion}
        error={errors.privacyConsent?.message}
        onCheckedChange={(checked) =>
          setValue("privacyConsent", checked, { shouldValidate: true })
        }
      />
      <OAuthSection
        label="Continue with Google"
        callbackUrl={safeCallback}
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
      <form
        onSubmit={onSubmit}
        noValidate
        className="auth-login-form space-y-5"
      >
        {formError ? (
          <Alert variant="error">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}
        <FormField
          label="Work email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          error={errors.email?.message}
          {...register("email")}
        />
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">Password</span>
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordField
            label="Password"
            className="[&>label]:sr-only"
            autoComplete="current-password"
            placeholder="Enter your password"
            error={errors.password?.message}
            {...register("password")}
          />
        </div>
        <Button
          type="submit"
          size="lg"
          className="w-full rounded-full"
          loading={isSubmitting}
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {demoCredentials ? (
        <button
          type="button"
          className="auth-demo-login mt-5 min-h-11 w-full px-3 text-xs"
          onClick={() => {
            setValue("email", demoCredentials.email, { shouldValidate: true });
            setValue("password", demoCredentials.password, {
              shouldValidate: true,
            });
          }}
        >
          Fill demo account credentials
        </button>
      ) : null}

      <p className="mt-7 text-center text-sm text-muted-foreground">
        New to Athreix?{" "}
        <Link
          href="/signup"
          className="font-semibold text-primary underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </>
  );
}

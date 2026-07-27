"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { PasswordField } from "@/components/auth/form-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const schema = z
  .object({
    password: z
      .string()
      .min(12, "Use at least 12 characters.")
      .regex(/[a-z]/, "Add a lowercase letter.")
      .regex(/[A-Z]/, "Add an uppercase letter.")
      .regex(/[0-9]/, "Add a number."),
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "The passwords do not match.",
  });

type ResetValues = z.infer<typeof schema>;

export function ResetPasswordForm({
  token,
  email,
}: {
  token?: string;
  email?: string;
}) {
  const [state, setState] = React.useState<"ready" | "invalid" | "success">(
    token && email ? "ready" : "invalid",
  );
  const [formError, setFormError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  React.useEffect(() => {
    if (token && typeof window !== "undefined") {
      window.history.replaceState({}, "", "/reset-password");
    }
  }, [token]);

  const onSubmit = handleSubmit(async (values) => {
    if (!token || !email) {
      setState("invalid");
      return;
    }

    setFormError(null);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email, password: values.password }),
      });
      const payload = (await response.json().catch(() => null)) as {
        data?: { message?: string };
        error?: { message?: string };
      } | null;

      if (
        response.status === 400 ||
        response.status === 404 ||
        response.status === 410
      ) {
        setState("invalid");
        return;
      }
      if (!response.ok) {
        setFormError(
          payload?.error?.message ??
            payload?.data?.message ??
            "We couldn’t update the password. Please try again.",
        );
        return;
      }
      setState("success");
    } catch {
      setFormError(
        "Password reset is temporarily unavailable. Please try again in a moment.",
      );
    }
  });

  if (state === "invalid") {
    return (
      <div>
        <Alert variant="warning" className="p-5">
          <AlertTriangle aria-hidden="true" />
          <div>
            <AlertTitle>This reset link is invalid or has expired</AlertTitle>
            <AlertDescription>
              Reset links are single-use and expire for your security. Request a
              fresh one to continue.
            </AlertDescription>
          </div>
        </Alert>
        <Button asChild className="mt-6 w-full">
          <Link href="/forgot-password">Request a new reset link</Link>
        </Button>
        <Button asChild variant="ghost" className="mt-2 w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  if (state === "success") {
    return (
      <div>
        <Alert variant="success" className="p-5">
          <CheckCircle2 aria-hidden="true" />
          <div>
            <AlertTitle>Password updated</AlertTitle>
            <AlertDescription>
              Your new password is active. You can now sign in to your
              workspace.
            </AlertDescription>
          </div>
        </Alert>
        <Button asChild className="mt-6 w-full">
          <Link href="/login">Continue to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError ? (
        <Alert variant="error">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}
      <PasswordField
        label="New password"
        autoComplete="new-password"
        placeholder="Create a secure password"
        hint="12+ characters with uppercase, lowercase, and a number."
        error={errors.password?.message}
        {...register("password")}
      />
      <PasswordField
        label="Confirm new password"
        autoComplete="new-password"
        placeholder="Enter the new password again"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />
      <Button type="submit" className="w-full" loading={isSubmitting}>
        {isSubmitting ? "Updating password…" : "Update password"}
      </Button>
    </form>
  );
}

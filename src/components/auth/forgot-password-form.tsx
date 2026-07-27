"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { FormField } from "@/components/auth/form-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});
type ForgotValues = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const [sent, setSent] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ForgotValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email.trim() }),
      });
      if (!response.ok) throw new Error("request failed");
      setSent(true);
    } catch {
      setFormError(
        "We couldn’t submit the request right now. Please wait a moment and try again.",
      );
    }
  });

  if (sent) {
    return (
      <div>
        <Alert variant="success" className="p-5">
          <CheckCircle2 aria-hidden="true" />
          <div>
            <AlertTitle>Check your email</AlertTitle>
            <AlertDescription>
              If an Athreix account exists for{" "}
              <strong>{getValues("email")}</strong>, we’ll send password-reset
              instructions shortly.
            </AlertDescription>
          </div>
        </Alert>
        <p className="mt-5 text-sm leading-6 text-muted-foreground">
          Didn’t receive anything? Check spam, wait a few minutes, or submit the
          form again. For security, we do not confirm whether an account exists.
        </p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <Button variant="outline" onClick={() => setSent(false)}>
            Try another email
          </Button>
          <Button asChild>
            <Link href="/login">Back to sign in</Link>
          </Button>
        </div>
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
      <FormField
        label="Work email"
        type="email"
        autoComplete="email"
        placeholder="you@company.com"
        error={errors.email?.message}
        {...register("email")}
      />
      <Button type="submit" className="w-full" loading={isSubmitting}>
        {isSubmitting ? "Submitting…" : "Send reset instructions"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link
          href="/login"
          className="font-semibold text-foreground underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

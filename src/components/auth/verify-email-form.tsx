"use client";

import { CheckCircle2, LoaderCircle, TriangleAlert } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type VerificationState = "verifying" | "verified" | "invalid" | "error";

export function VerifyEmailForm({
  email,
  token,
}: {
  email?: string;
  token?: string;
}) {
  const [state, setState] = React.useState<VerificationState>(
    email && token ? "verifying" : "invalid",
  );
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    if (!email || !token) return;
    let active = true;
    window.history.replaceState({}, "", "/verify-email");

    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, token }),
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as {
          data?: { message?: string };
          error?: { code?: string; message?: string };
        } | null;
        if (!response.ok) {
          const invalid = [
            "VERIFICATION_TOKEN_INVALID",
            "VERIFICATION_TOKEN_EXPIRED",
          ].includes(payload?.error?.code ?? "");
          if (active) {
            setMessage(payload?.error?.message ?? "Email verification failed.");
            setState(invalid ? "invalid" : "error");
          }
          return;
        }
        if (active) {
          setMessage(payload?.data?.message ?? "Email verified.");
          setState("verified");
        }
      })
      .catch(() => {
        if (active) {
          setMessage(
            "Verification is temporarily unavailable. Try again shortly.",
          );
          setState("error");
        }
      });

    return () => {
      active = false;
    };
  }, [email, token]);

  if (state === "verifying") {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center text-center">
        <LoaderCircle
          aria-hidden="true"
          className="size-7 animate-spin text-muted-foreground motion-reduce:animate-none"
        />
        <p className="mt-4 text-sm font-medium">Verifying your email…</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Keep this page open for a moment.
        </p>
      </div>
    );
  }

  if (state === "verified") {
    return (
      <div>
        <Alert variant="success" className="p-5">
          <CheckCircle2 aria-hidden="true" />
          <div>
            <AlertTitle>Email verified</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </div>
        </Alert>
        <Button asChild className="mt-6 w-full">
          <Link href="/login?verified=1">Sign in to Athreix</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <Alert
        variant={state === "invalid" ? "warning" : "error"}
        className="p-5"
      >
        <TriangleAlert aria-hidden="true" />
        <div>
          <AlertTitle>
            {state === "invalid"
              ? "This verification link is invalid or expired"
              : "Verification is unavailable"}
          </AlertTitle>
          <AlertDescription>
            {message ||
              "Open the complete link from your verification email or request a new account link."}
          </AlertDescription>
        </div>
      </Alert>
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <Button asChild variant="outline">
          <Link href="/signup">Return to sign up</Link>
        </Button>
        <Button asChild>
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    </div>
  );
}

"use client";

import { getProviders, signIn } from "next-auth/react";
import * as React from "react";

import { Button } from "@/components/ui/button";

function GoogleButton({
  label,
  callbackUrl = "/search",
  onBeforeSignIn,
}: {
  label: string;
  callbackUrl?: string;
  onBeforeSignIn?: () => Promise<boolean>;
}) {
  const [loading, setLoading] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full rounded-full bg-card/70"
        loading={loading}
        onClick={async () => {
          setFailed(false);
          setLoading(true);
          try {
            if (onBeforeSignIn && !(await onBeforeSignIn())) {
              setLoading(false);
              return;
            }
            await signIn("google", { redirectTo: callbackUrl });
          } catch {
            setLoading(false);
            setFailed(true);
          }
        }}
      >
        {!loading ? (
          <span
            aria-hidden="true"
            className="flex size-5 items-center justify-center rounded-full border text-[11px] font-bold"
          >
            G
          </span>
        ) : null}
        {loading ? "Connecting…" : label}
      </Button>
      {failed ? (
        <p role="alert" className="mt-2 text-xs font-medium text-destructive">
          Google sign-in couldn’t start. Try again or continue with email.
        </p>
      ) : null}
    </div>
  );
}

export function FormDivider() {
  return (
    <div className="relative my-6" role="separator">
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <span className="w-full border-t" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-card px-3 text-xs text-muted-foreground">
          or continue with email
        </span>
      </div>
    </div>
  );
}

export function OAuthSection({
  label,
  callbackUrl = "/search",
  consentNotice,
  onBeforeSignIn,
}: {
  label: string;
  callbackUrl?: string;
  consentNotice?: React.ReactNode;
  onBeforeSignIn?: () => Promise<boolean>;
}) {
  const [googleAvailable, setGoogleAvailable] = React.useState<boolean | null>(
    null,
  );

  React.useEffect(() => {
    let active = true;
    getProviders()
      .then((providers) => {
        if (active) setGoogleAvailable(Boolean(providers?.google));
      })
      .catch(() => {
        if (active) setGoogleAvailable(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (googleAvailable === null) {
    return (
      <div
        className="mb-6 h-11 animate-pulse rounded-lg bg-muted"
        aria-label="Checking available sign-in methods"
      />
    );
  }

  if (!googleAvailable) return null;

  return (
    <>
      <GoogleButton
        label={label}
        callbackUrl={callbackUrl}
        onBeforeSignIn={onBeforeSignIn}
      />
      {consentNotice}
      <FormDivider />
    </>
  );
}

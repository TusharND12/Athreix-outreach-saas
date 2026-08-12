import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to your Athreix Prospect AI workspace.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    callbackUrl?: string;
    created?: string;
    verified?: string;
    pending?: string;
    consent?: string;
  }>;
}) {
  const params = await searchParams;
  const showDemo =
    process.env.DEMO_MODE === "true" || process.env.NODE_ENV !== "production";
  return (
    <AuthShell
      title="Welcome back"
      description="Continue to your prospect intelligence workspace."
      compact
    >
      <LoginForm
        callbackUrl={params.callbackUrl}
        privacyNoticeVersion={
          process.env.PRIVACY_NOTICE_VERSION ?? "2026-08-11"
        }
        accountCreated={params.created === "1"}
        emailVerified={params.verified === "1"}
        pendingApproval={params.pending === "1"}
        consentWithdrawn={params.consent === "withdrawn"}
        demoCredentials={
          showDemo
            ? { email: "demo@athreix.ai", password: "AthreixDemo2026!" }
            : undefined
        }
      />
    </AuthShell>
  );
}

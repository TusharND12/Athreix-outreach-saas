import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create your Athreix Prospect AI account.",
};

export default function SignupPage() {
  const termsVersion = process.env.TERMS_VERSION ?? "2026-08-11";
  const responsibleUseVersion =
    process.env.RESPONSIBLE_USE_VERSION ?? "2026-08-11";
  const privacyNoticeVersion =
    process.env.PRIVACY_NOTICE_VERSION ?? "2026-08-11";
  const demoMode =
    process.env.DEMO_MODE === "true" ||
    (process.env.NODE_ENV !== "production" && !process.env.FIREBASE_PROJECT_ID);
  return (
    <AuthShell
      title="Create your workspace"
      description="Start with a clear brief and turn it into an explainable prospect list."
    >
      <SignupForm
        termsVersion={termsVersion}
        responsibleUseVersion={responsibleUseVersion}
        privacyNoticeVersion={privacyNoticeVersion}
        demoMode={demoMode}
      />
    </AuthShell>
  );
}

import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";

export const metadata: Metadata = {
  title: "Verify email",
  description: "Verify your Athreix Prospect AI account.",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; token?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthShell
      title="Verify your email"
      description="Verification protects the workspace and activates your starter credits."
    >
      <VerifyEmailForm email={params.email} token={params.token} />
    </AuthShell>
  );
}

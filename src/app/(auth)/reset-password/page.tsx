import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Choose a new password",
  description: "Complete a secure Athreix password reset.",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthShell
      title="Choose a new password"
      description="Use a unique password you do not use on another service."
    >
      <ResetPasswordForm token={params.token} email={params.email} />
    </AuthShell>
  );
}

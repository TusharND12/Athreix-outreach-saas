import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Request password reset instructions for your Athreix account.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      description="Enter your work email. If an account exists, we’ll send secure reset instructions."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}

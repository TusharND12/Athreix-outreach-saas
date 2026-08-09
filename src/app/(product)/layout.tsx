import type { Metadata } from "next";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { AppShell } from "@/components/product/app-shell";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ProductLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  return (
    <AppShell isPlatformAdmin={Boolean(session?.user?.isPlatformAdmin)}>
      {children}
    </AppShell>
  );
}

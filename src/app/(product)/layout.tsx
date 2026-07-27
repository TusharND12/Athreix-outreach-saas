import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/product/app-shell";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ProductLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

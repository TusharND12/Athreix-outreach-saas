import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminConsole } from "@/components/admin/admin-console";
import { requirePlatformAdmin } from "@/server/auth-context";

export const metadata: Metadata = {
  title: "Admin operations",
  description: "Controlled customer onboarding and platform operations.",
};

export default async function AdminPage() {
  try {
    await requirePlatformAdmin();
  } catch {
    redirect("/search");
  }
  return <AdminConsole />;
}

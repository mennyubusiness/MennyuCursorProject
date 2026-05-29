import { redirect } from "next/navigation";
import { isAdminDashboardLayoutAuthorized } from "@/lib/admin-auth";
import { env } from "@/lib/env";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const allowed = await isAdminDashboardLayoutAuthorized();
  if (!allowed && env.NODE_ENV === "production") {
    redirect("/admin/access-denied");
  }

  return <>{children}</>;
}

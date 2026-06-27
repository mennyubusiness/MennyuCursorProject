import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminDashboardLayoutAuthorized } from "@/lib/admin-auth";
import {
  getPlatformAdminEmailVerificationRedirect,
  shouldSkipEmailVerificationGate,
} from "@/lib/auth/email-verification-access.server";
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

  if (!(await shouldSkipEmailVerificationGate())) {
    const session = await auth();
    const redirectTo = getPlatformAdminEmailVerificationRedirect({
      isPlatformAdmin: Boolean(session?.user?.isPlatformAdmin),
      emailVerified: Boolean(session?.user?.isEmailVerified),
    });
    if (redirectTo) redirect(redirectTo);
  }

  return <>{children}</>;
}

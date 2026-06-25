import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getPendingAccountSetupRedirect } from "@/lib/auth/account-setup";
import { ACCOUNT_ROLE_PATH } from "@/lib/auth/account-paths";
import { appendNextQueryParam } from "@/lib/auth/invite-token-path";
import { sanitizeLoginReturnPath } from "@/lib/auth/login-return-path";
import { DashboardCard } from "@/components/dashboard";
import { RolePicker } from "./RolePicker";

function RolePickerFallback() {
  return (
    <div className="animate-pulse space-y-4" role="status">
      <div className="h-8 w-64 rounded bg-oo-light-stone" />
      <div className="h-24 rounded-xl bg-oo-cream" />
      <p className="sr-only">Loading account setup…</p>
    </div>
  );
}

export default async function AccountRolePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const sp = await searchParams;
  const nextPath = sanitizeLoginReturnPath(sp.next ?? null);

  const pending = await getPendingAccountSetupRedirect(session.user.id);
  if (pending && pending !== ACCOUNT_ROLE_PATH) {
    redirect(nextPath ? appendNextQueryParam(pending, nextPath) : pending);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { needsAccountRoleSelection: true },
  });

  if (!user?.needsAccountRoleSelection) {
    redirect("/");
  }

  return (
    <DashboardCard>
      <Suspense fallback={<RolePickerFallback />}>
        <RolePicker />
      </Suspense>
    </DashboardCard>
  );
}

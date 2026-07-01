import { redirect } from "next/navigation";
import { RegistrationIntent } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  ensureVendorRegistrationIntent,
  getPendingAccountSetupRedirect,
} from "@/lib/auth/account-setup";
import { ACCOUNT_SETUP_VENDOR_PATH } from "@/lib/auth/account-paths";
import {
  getValidatedPendingVendorInviteForUser,
  persistPendingVendorInviteFromReturnPath,
} from "@/lib/auth/pending-vendor-invite.server";
import { sanitizeLoginReturnPath } from "@/lib/auth/login-return-path";
import { appendNextQueryParam, isVendorInvitePath } from "@/lib/auth/invite-token-path";
import { DashboardCard } from "@/components/dashboard";
import { VendorSetupForm } from "./VendorSetupForm";

export default async function VendorSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const pending = await getPendingAccountSetupRedirect(session.user.id);
  const { next: nextRaw } = await searchParams;
  const nextPath = sanitizeLoginReturnPath(nextRaw ?? null);
  if (pending && pending !== ACCOUNT_SETUP_VENDOR_PATH) {
    redirect(nextPath ? appendNextQueryParam(pending, nextPath) : pending);
  }

  if (nextPath && isVendorInvitePath(nextPath)) {
    await persistPendingVendorInviteFromReturnPath(session.user.id, nextPath);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { registrationIntent: true },
  });
  if (user?.registrationIntent !== RegistrationIntent.vendor) {
    if (nextPath && isVendorInvitePath(nextPath)) {
      await ensureVendorRegistrationIntent(session.user.id);
    } else {
      redirect("/");
    }
  }

  const pendingInvite = await getValidatedPendingVendorInviteForUser(session.user.id);
  const inviteContext =
    pendingInvite.status === "active"
      ? {
          podName: pendingInvite.podName,
          invitedVendorName: pendingInvite.invitedVendorName,
        }
      : null;
  const inviteWarning =
    pendingInvite.status !== "active" && pendingInvite.status !== "none"
      ? pendingInvite.message
      : null;

  return (
    <DashboardCard>
      <VendorSetupForm nextPath={nextPath} inviteContext={inviteContext} inviteWarning={inviteWarning} />
    </DashboardCard>
  );
}

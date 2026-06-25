import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { ensureVendorRegistrationIntentForInvite } from "@/actions/account-setup.actions";
import { ACCOUNT_SETUP_VENDOR_PATH } from "@/lib/auth/account-paths";
import {
  appendNextQueryParam,
  buildVendorInvitePath,
} from "@/lib/auth/invite-token-path";
import { normalizeSecureInviteTokenFromRequest } from "@/lib/auth/secure-invite-token";
import {
  acceptPodVendorInvite,
  resolvePodVendorInviteByToken,
} from "@/services/pod-vendor-invite.service";
import { VendorInviteLanding } from "./VendorInviteLanding";

export default async function VendorInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token: rawToken } = await params;
  const token = normalizeSecureInviteTokenFromRequest(rawToken);
  if (!token) notFound();

  const invite = await resolvePodVendorInviteByToken(token);
  const session = await auth();
  const invitePath = buildVendorInvitePath(token);

  if (session?.user?.id && session.user.email && invite.ok && invite.status === "pending") {
    const acceptResult = await acceptPodVendorInvite({
      rawToken: token,
      userId: session.user.id,
      userEmail: session.user.email,
    });

    if (acceptResult.ok) {
      redirect(
        `/vendor/${acceptResult.vendorId}/settings?section=pod-membership&access=pod_connected`
      );
    }

    if (acceptResult.code === "no_vendor_account") {
      await ensureVendorRegistrationIntentForInvite();
      redirect(appendNextQueryParam(ACCOUNT_SETUP_VENDOR_PATH, invitePath));
    }

    if (acceptResult.code === "email_mismatch") {
      return (
        <main className="min-h-[60vh] bg-oo-cream px-4 py-10">
          <VendorInviteLanding
            token={token}
            invite={invite}
            signedIn
            userEmail={session.user.email}
            initialEmailMismatch={{
              invitedEmail: acceptResult.invitedEmail ?? invite.invitedEmail ?? "",
              currentEmail: acceptResult.currentEmail ?? session.user.email,
            }}
          />
        </main>
      );
    }
  }

  return (
    <main className="min-h-[60vh] bg-oo-cream px-4 py-10">
      <VendorInviteLanding
        token={token}
        invite={invite}
        signedIn={Boolean(session?.user?.id)}
        userEmail={session?.user?.email ?? null}
      />
    </main>
  );
}

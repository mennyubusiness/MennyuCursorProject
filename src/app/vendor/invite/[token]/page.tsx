import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { normalizeSecureInviteTokenFromRequest } from "@/lib/auth/secure-invite-token";
import { resolvePodVendorInviteByToken } from "@/services/pod-vendor-invite.service";
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

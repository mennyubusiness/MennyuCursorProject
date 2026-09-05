import Link from "next/link";
import { auth } from "@/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { ButtonLink } from "@/components/ui/button";
import { buildLoginHrefWithReturn, buildRegisterHrefWithReturn } from "@/lib/auth/invite-auth-links";
import { normalizeAccountEmail } from "@/lib/auth/password-policy";
import { buildPodClaimInvitePath } from "@/lib/auth/secure-invite-token";
import { prisma } from "@/lib/db";
import { resolvePodClaimInviteByToken } from "@/services/pod-claim-invite.service";
import { PodClaimPanel } from "./PodClaimPanel";

export default async function PodClaimPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await resolvePodClaimInviteByToken(token);
  if (invite.status !== "active") {
    return (
      <AuthShell>
        <ClaimCard title="Claim link unavailable">
          <p className="text-sm text-oo-stone-gray">{invite.message}</p>
        </ClaimCard>
      </AuthShell>
    );
  }

  const returnPath = buildPodClaimInvitePath(token);
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <AuthShell>
        <ClaimCard title={`Claim ${invite.podName}`}>
          <ClaimExplanation address={invite.address} />
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={buildLoginHrefWithReturn(returnPath)}>Sign in to claim</ButtonLink>
            <ButtonLink href={buildRegisterHrefWithReturn(returnPath, "pod_owner")} variant="outline">
              Create account
            </ButtonLink>
          </div>
        </ClaimCard>
      </AuthShell>
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, emailVerified: true },
  });
  const wrongAccount =
    !user || normalizeAccountEmail(user.email) !== normalizeAccountEmail(invite.invitedEmail);

  return (
    <AuthShell>
      <ClaimCard title={`Claim ${invite.podName}`}>
        <ClaimExplanation address={invite.address} />
        <div className="mt-5 rounded-xl border border-oo-light-stone bg-oo-cream/50 px-4 py-3 text-sm">
          <p className="text-oo-stone-gray">Invitation sent to</p>
          <p className="mt-1 font-semibold text-oo-charcoal">{invite.invitedEmail}</p>
        </div>
        {wrongAccount ? (
          <div className="mt-5">
            <p className="text-sm text-red-700">
              Sign in with {invite.invitedEmail} to claim this pod.
            </p>
            <Link
              href={buildLoginHrefWithReturn(returnPath)}
              className="mt-4 inline-flex font-semibold text-brand underline"
            >
              Use another account
            </Link>
          </div>
        ) : (
          <PodClaimPanel token={token} emailVerified={Boolean(user?.emailVerified)} />
        )}
      </ClaimCard>
    </AuthShell>
  );
}

function ClaimCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-lg rounded-2xl border border-oo-light-stone bg-oo-warm-white p-6 shadow-sm">
      <h1 className="text-2xl font-black tracking-tight text-oo-charcoal">{title}</h1>
      {children}
    </div>
  );
}

function ClaimExplanation({ address }: { address: string | null }) {
  return (
    <p className="mt-3 text-sm leading-relaxed text-oo-stone-gray">
      Open Order has already set up this pod and its vendor menus
      {address ? ` for ${address}` : ""}. Claim this pod to manage its profile, vendors, sharing
      tools, and dashboard.
    </p>
  );
}

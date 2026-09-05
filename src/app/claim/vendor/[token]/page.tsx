import Link from "next/link";
import { auth } from "@/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { buildLoginHrefWithReturn, buildRegisterHrefWithReturn } from "@/lib/auth/invite-auth-links";
import { normalizeAccountEmail } from "@/lib/auth/password-policy";
import { buildVendorClaimInvitePath } from "@/lib/auth/secure-invite-token";
import { prisma } from "@/lib/db";
import { resolveVendorClaimInviteByToken } from "@/services/vendor-claim-invite.service";
import { VendorClaimPanel } from "./VendorClaimPanel";
import { ButtonLink } from "@/components/ui/button";

export default async function VendorClaimPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await resolveVendorClaimInviteByToken(token);
  if (invite.status !== "active") {
    return (
      <AuthShell>
        <ClaimCard title="Claim link unavailable">
          <p className="text-sm text-oo-stone-gray">{invite.message}</p>
        </ClaimCard>
      </AuthShell>
    );
  }

  const returnPath = buildVendorClaimInvitePath(token);
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <AuthShell>
        <ClaimCard title={`Claim ${invite.vendorName}`}>
          <ClaimExplanation podName={invite.podName} />
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={buildLoginHrefWithReturn(returnPath)}>
              Sign in to claim
            </ButtonLink>
            <ButtonLink href={buildRegisterHrefWithReturn(returnPath)} variant="outline">
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
      <ClaimCard title={`Claim ${invite.vendorName}`}>
        <ClaimExplanation podName={invite.podName} />
        <div className="mt-5 rounded-xl border border-oo-light-stone bg-oo-cream/50 px-4 py-3 text-sm">
          <p className="text-oo-stone-gray">Invitation sent to</p>
          <p className="mt-1 font-semibold text-oo-charcoal">{invite.invitedEmail}</p>
        </div>
        {wrongAccount ? (
          <div className="mt-5">
            <p className="text-sm text-red-700">
              Sign in with {invite.invitedEmail} to claim this vendor.
            </p>
            <Link
              href={buildLoginHrefWithReturn(returnPath)}
              className="mt-4 inline-flex font-semibold text-brand underline"
            >
              Use another account
            </Link>
          </div>
        ) : (
          <VendorClaimPanel token={token} emailVerified={Boolean(user?.emailVerified)} />
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

function ClaimExplanation({ podName }: { podName: string | null }) {
  return (
    <p className="mt-3 text-sm leading-relaxed text-oo-stone-gray">
      Open Order has already set up your vendor profile and menu
      {podName ? ` for ${podName}` : ""}. Claim this profile to manage your menu, hours, and
      business information.
    </p>
  );
}

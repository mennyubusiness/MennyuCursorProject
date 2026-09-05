"use server";

import { auth } from "@/auth";
import { acceptVendorClaimInvite } from "@/services/vendor-claim-invite.service";
import { resolveVendorClaimInviteByToken } from "@/services/vendor-claim-invite.service";
import { prisma } from "@/lib/db";
import { normalizeAccountEmail } from "@/lib/auth/password-policy";
import { buildVendorClaimInvitePath } from "@/lib/auth/secure-invite-token";
import { sendEmailVerificationEmail } from "@/services/email-verification.service";

export async function acceptVendorClaimInviteAction(rawToken: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, code: "anonymous" as const, message: "Sign in to claim this vendor." };
  }
  return acceptVendorClaimInvite({ rawToken, userId: session.user.id });
}

export async function resendClaimEmailVerificationAction(rawToken: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Sign in first." };
  const invite = await resolveVendorClaimInviteByToken(rawToken);
  if (invite.status !== "active") return { ok: false as const, error: invite.message };
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  });
  if (!user || normalizeAccountEmail(user.email) !== normalizeAccountEmail(invite.invitedEmail)) {
    return { ok: false as const, error: "Sign in with the email that received this invitation." };
  }
  const result = await sendEmailVerificationEmail({
    userId: session.user.id,
    initiator: "user",
    returnPath: buildVendorClaimInvitePath(rawToken),
  });
  return result.ok ? result : { ok: false as const, error: result.error };
}

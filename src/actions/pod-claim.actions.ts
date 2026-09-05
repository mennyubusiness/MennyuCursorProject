"use server";

import { auth } from "@/auth";
import { normalizeAccountEmail } from "@/lib/auth/password-policy";
import { buildPodClaimInvitePath } from "@/lib/auth/secure-invite-token";
import { prisma } from "@/lib/db";
import { sendEmailVerificationEmail } from "@/services/email-verification.service";
import {
  acceptPodClaimInvite,
  resolvePodClaimInviteByToken,
} from "@/services/pod-claim-invite.service";

export async function acceptPodClaimInviteAction(rawToken: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, code: "anonymous" as const, message: "Sign in to claim this pod." };
  }
  return acceptPodClaimInvite({ rawToken, userId: session.user.id });
}

export async function resendPodClaimEmailVerificationAction(rawToken: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Sign in first." };
  const invite = await resolvePodClaimInviteByToken(rawToken);
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
    returnPath: buildPodClaimInvitePath(rawToken),
  });
  return result.ok ? result : { ok: false as const, error: result.error };
}

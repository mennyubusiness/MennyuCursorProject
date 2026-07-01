/**
 * Persists pod-scoped vendor invite context on User for resumable onboarding.
 * Raw invite tokens are never stored — only PodVendorInvite.id.
 */
import "server-only";

import { RegistrationIntent } from "@prisma/client";
import { extractInviteTokenFromPath } from "@/lib/auth/invite-token-path";
import { normalizeAccountEmail } from "@/lib/auth/password-policy";
import { hashSecureInviteToken } from "@/lib/auth/secure-invite-token";
import { prisma } from "@/lib/db";

const INVITE_PENDING = "pending";
const INVITE_CANCELLED = "cancelled";
const INVITE_ACCEPTED = "accepted";
const INVITE_EXPIRED = "expired";

export type PendingVendorInviteState =
  | {
      status: "active";
      inviteId: string;
      podId: string;
      podName: string;
      invitedVendorName: string | null;
    }
  | { status: "none" }
  | { status: "expired" | "cancelled" | "invalid" | "email_mismatch"; message: string };

export async function clearPendingVendorInviteForUser(userId: string): Promise<void> {
  await prisma.user.updateMany({
    where: { id: userId, pendingVendorInviteId: { not: null } },
    data: { pendingVendorInviteId: null },
  });
}

async function loadInviteForPersistence(inviteId: string) {
  return prisma.podVendorInvite.findUnique({
    where: { id: inviteId },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      invitedEmail: true,
      pod: { select: { id: true, name: true } },
    },
  });
}

/** Latest invite wins when user opens a new pod invite before completing setup. */
export async function persistPendingVendorInviteForUser(
  userId: string,
  inviteId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const invite = await loadInviteForPersistence(inviteId);
  if (!invite) return { ok: false, error: "Invite not found." };
  if (invite.status === INVITE_CANCELLED) {
    return { ok: false, error: "This invite was cancelled." };
  }
  if (invite.status === INVITE_ACCEPTED) {
    return { ok: false, error: "This invite has already been used." };
  }
  if (invite.status === INVITE_EXPIRED || invite.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "This invite has expired." };
  }
  if (invite.status !== INVITE_PENDING) {
    return { ok: false, error: "This invite is not available." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      pendingVendorInviteId: invite.id,
      registrationIntent: RegistrationIntent.vendor,
      needsAccountRoleSelection: false,
    },
  });
  return { ok: true };
}

export async function persistPendingVendorInviteFromToken(
  userId: string,
  rawToken: string
): Promise<{ ok: true; inviteId: string } | { ok: false; error: string }> {
  const token = rawToken.trim();
  if (!token) return { ok: false, error: "Missing invite token." };

  const invite = await prisma.podVendorInvite.findUnique({
    where: { tokenHash: hashSecureInviteToken(token) },
    select: { id: true },
  });
  if (!invite) return { ok: false, error: "Invite not found." };

  const persisted = await persistPendingVendorInviteForUser(userId, invite.id);
  if (!persisted.ok) return persisted;
  return { ok: true, inviteId: invite.id };
}

export async function persistPendingVendorInviteFromReturnPath(
  userId: string,
  returnPath: string | null | undefined
): Promise<{ ok: true } | { ok: false; error: string } | { ok: true; skipped: true }> {
  const token = extractInviteTokenFromPath(returnPath ?? null);
  if (!token) return { ok: true, skipped: true };
  const result = await persistPendingVendorInviteFromToken(userId, token);
  if (!result.ok) return result;
  return { ok: true };
}

export async function getValidatedPendingVendorInviteForUser(
  userId: string
): Promise<PendingVendorInviteState> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      pendingVendorInviteId: true,
      pendingVendorInvite: {
        select: {
          id: true,
          status: true,
          expiresAt: true,
          invitedEmail: true,
          invitedVendorName: true,
          pod: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!user?.pendingVendorInviteId || !user.pendingVendorInvite) {
    return { status: "none" };
  }

  const invite = user.pendingVendorInvite;
  const userEmail = normalizeAccountEmail(user.email);

  if (invite.status === INVITE_CANCELLED) {
    await clearPendingVendorInviteForUser(userId);
    return {
      status: "cancelled",
      message: "Your pod invite was cancelled. Ask the pod owner for a new invite.",
    };
  }

  if (
    invite.status === INVITE_EXPIRED ||
    (invite.status === INVITE_PENDING && invite.expiresAt.getTime() < Date.now())
  ) {
    await clearPendingVendorInviteForUser(userId);
    return {
      status: "expired",
      message: "Your pod invite expired. Ask the pod owner for a new invite.",
    };
  }

  if (invite.status === INVITE_ACCEPTED) {
    await clearPendingVendorInviteForUser(userId);
    return { status: "none" };
  }

  if (invite.status !== INVITE_PENDING) {
    await clearPendingVendorInviteForUser(userId);
    return { status: "invalid", message: "Your saved pod invite is no longer valid." };
  }

  if (normalizeAccountEmail(invite.invitedEmail) !== userEmail) {
    return {
      status: "email_mismatch",
      message: `This invite was sent to ${invite.invitedEmail}. Sign in with that email to continue.`,
    };
  }

  return {
    status: "active",
    inviteId: invite.id,
    podId: invite.pod.id,
    podName: invite.pod.name,
    invitedVendorName: invite.invitedVendorName,
  };
}

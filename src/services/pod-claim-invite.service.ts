import "server-only";

import { revalidatePath } from "next/cache";
import { ADMIN_AUDIT_ACTION, ADMIN_AUDIT_TARGET, requireAdminReason } from "@/lib/admin-audit-log";
import {
  buildPodClaimInviteUrl,
  generateSecureInviteToken,
  hashSecureInviteToken,
  normalizeSecureInviteTokenFromRequest,
  POD_CLAIM_INVITE_TTL_MS,
} from "@/lib/auth/secure-invite-token";
import { normalizeAccountEmail, validateAccountEmail } from "@/lib/auth/password-policy";
import { buildPodCustomerPath } from "@/lib/customer-public-url";
import { prisma } from "@/lib/db";
import { sendPodClaimInviteEmail } from "@/lib/email/pod-claim-invite-email";
import { getPublicSiteOriginFromEnv } from "@/lib/public-site-url";
import { createAdminAuditLog } from "@/services/admin-audit-log.service";
import { PodMembershipRole, Prisma, RegistrationIntent } from "@prisma/client";

type InviteActionResult =
  | {
      ok: true;
      inviteId: string;
      inviteUrl?: string;
      emailStatus?: string;
      message: string;
    }
  | { ok: false; error: string };

function inviteOrigin(requestOrigin?: string): string {
  const configured = getPublicSiteOriginFromEnv();
  if (process.env.PUBLIC_APP_URL?.trim() || process.env.NEXTAUTH_URL?.trim()) {
    return configured;
  }
  return requestOrigin?.replace(/\/$/, "") || configured;
}

async function loadClaimablePod(podId: string) {
  return prisma.pod.findUnique({
    where: { id: podId },
    select: {
      id: true,
      name: true,
      slug: true,
      address: true,
      isActive: true,
      deletedAt: true,
      memberships: {
        where: { role: "owner" },
        select: { id: true },
        take: 1,
      },
      claimInvite: {
        select: {
          id: true,
          invitedEmail: true,
          expiresAt: true,
          claimedAt: true,
          revokedAt: true,
        },
      },
    },
  });
}

function revalidateClaimAdminSurfaces(podId: string, slug?: string | null) {
  revalidatePath(`/admin/pods/${podId}`);
  revalidatePath("/admin/pods");
  revalidatePath(`/pod/${podId}/dashboard`);
  if (slug) revalidatePath(buildPodCustomerPath(slug));
}

export async function sendPodClaimInvite(input: {
  podId: string;
  invitedEmail: string;
  adminUserId: string | null;
  reason: string;
  requestOrigin?: string;
}): Promise<InviteActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;
  const invitedEmail = normalizeAccountEmail(input.invitedEmail);
  const emailError = validateAccountEmail(invitedEmail);
  if (emailError) return { ok: false, error: emailError };

  const pod = await loadClaimablePod(input.podId);
  if (!pod || pod.deletedAt || !pod.isActive) {
    return { ok: false, error: "This pod can no longer be claimed." };
  }
  if (pod.memberships.length > 0) {
    return { ok: false, error: "This pod already has an owner." };
  }
  const now = new Date();
  const existingActive =
    pod.claimInvite &&
    !pod.claimInvite.claimedAt &&
    !pod.claimInvite.revokedAt &&
    pod.claimInvite.expiresAt > now;
  if (existingActive) {
    return { ok: false, error: "An active claim invitation already exists. Resend or revoke it." };
  }

  const rawToken = generateSecureInviteToken();
  const tokenHash = hashSecureInviteToken(rawToken);
  const expiresAt = new Date(now.getTime() + POD_CLAIM_INVITE_TTL_MS);
  const invite = await prisma.podClaimInvite.upsert({
    where: { podId: pod.id },
    create: {
      podId: pod.id,
      invitedEmail,
      tokenHash,
      expiresAt,
      invitedByUserId: input.adminUserId,
      lastSentAt: now,
    },
    update: {
      invitedEmail,
      tokenHash,
      expiresAt,
      claimedAt: null,
      claimedByUserId: null,
      revokedAt: null,
      invitedByUserId: input.adminUserId,
      lastSentAt: now,
    },
    select: { id: true },
  });

  const inviteUrl = buildPodClaimInviteUrl(inviteOrigin(input.requestOrigin), rawToken);
  const email = await sendPodClaimInviteEmail({
    to: invitedEmail,
    podName: pod.name,
    address: pod.address,
    inviteUrl,
  });

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.POD_CLAIM_INVITE_SENT,
    targetType: ADMIN_AUDIT_TARGET.pod,
    targetId: pod.id,
    reason: reasonCheck.reason,
    newValue: { inviteId: invite.id, invitedEmail, expiresAt: expiresAt.toISOString() },
    metadata: { podId: pod.id, invitedEmail },
  });
  revalidateClaimAdminSurfaces(pod.id, pod.slug);

  return {
    ok: true,
    inviteId: invite.id,
    inviteUrl,
    emailStatus: email.status,
    message: `Claim invitation sent to ${invitedEmail}.`,
  };
}

export async function resendPodClaimInvite(input: {
  podId: string;
  adminUserId: string | null;
  reason: string;
  requestOrigin?: string;
}): Promise<InviteActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;
  const pod = await loadClaimablePod(input.podId);
  if (!pod || pod.deletedAt || !pod.isActive) {
    return { ok: false, error: "This pod can no longer be claimed." };
  }
  if (pod.memberships.length > 0) {
    return { ok: false, error: "This pod already has an owner." };
  }
  if (!pod.claimInvite || pod.claimInvite.claimedAt) {
    return { ok: false, error: "There is no claim invitation to resend." };
  }

  const now = new Date();
  const rawToken = generateSecureInviteToken();
  const tokenHash = hashSecureInviteToken(rawToken);
  const expiresAt = new Date(now.getTime() + POD_CLAIM_INVITE_TTL_MS);
  await prisma.podClaimInvite.update({
    where: { id: pod.claimInvite.id },
    data: {
      tokenHash,
      expiresAt,
      revokedAt: null,
      claimedAt: null,
      claimedByUserId: null,
      invitedByUserId: input.adminUserId,
      lastSentAt: now,
    },
  });

  const inviteUrl = buildPodClaimInviteUrl(inviteOrigin(input.requestOrigin), rawToken);
  const email = await sendPodClaimInviteEmail({
    to: pod.claimInvite.invitedEmail,
    podName: pod.name,
    address: pod.address,
    inviteUrl,
  });
  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.POD_CLAIM_INVITE_RESENT,
    targetType: ADMIN_AUDIT_TARGET.pod,
    targetId: pod.id,
    reason: reasonCheck.reason,
    newValue: {
      inviteId: pod.claimInvite.id,
      invitedEmail: pod.claimInvite.invitedEmail,
      expiresAt: expiresAt.toISOString(),
    },
    metadata: { podId: pod.id, invitedEmail: pod.claimInvite.invitedEmail },
  });
  revalidateClaimAdminSurfaces(pod.id, pod.slug);
  return {
    ok: true,
    inviteId: pod.claimInvite.id,
    inviteUrl,
    emailStatus: email.status,
    message: `A new claim invitation was sent to ${pod.claimInvite.invitedEmail}.`,
  };
}

export async function revokePodClaimInvite(input: {
  podId: string;
  adminUserId: string | null;
  reason: string;
}): Promise<InviteActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;
  const pod = await loadClaimablePod(input.podId);
  if (!pod || !pod.claimInvite) return { ok: false, error: "Claim invitation not found." };
  if (pod.claimInvite.claimedAt) return { ok: false, error: "This invitation has already been used." };
  if (pod.claimInvite.revokedAt) return { ok: false, error: "This invitation is already revoked." };

  await prisma.podClaimInvite.update({
    where: { id: pod.claimInvite.id },
    data: { revokedAt: new Date() },
  });
  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.POD_CLAIM_INVITE_REVOKED,
    targetType: ADMIN_AUDIT_TARGET.pod,
    targetId: pod.id,
    reason: reasonCheck.reason,
    oldValue: { inviteId: pod.claimInvite.id, invitedEmail: pod.claimInvite.invitedEmail },
    metadata: { podId: pod.id, invitedEmail: pod.claimInvite.invitedEmail },
  });
  revalidateClaimAdminSurfaces(pod.id, pod.slug);
  return {
    ok: true,
    inviteId: pod.claimInvite.id,
    message: "Claim invitation revoked.",
  };
}

export type PodClaimInvitePublicView =
  | {
      status: "active";
      podId: string;
      podName: string;
      address: string | null;
      invitedEmail: string;
      expiresAt: Date;
    }
  | { status: "invalid" | "expired" | "revoked" | "already_claimed"; message: string };

export async function resolvePodClaimInviteByToken(
  rawToken: string
): Promise<PodClaimInvitePublicView> {
  const token = normalizeSecureInviteTokenFromRequest(rawToken);
  if (!token) return { status: "invalid", message: "This claim link is no longer valid." };
  const invite = await prisma.podClaimInvite.findUnique({
    where: { tokenHash: hashSecureInviteToken(token) },
    select: {
      invitedEmail: true,
      expiresAt: true,
      claimedAt: true,
      revokedAt: true,
      pod: {
        select: {
          id: true,
          name: true,
          address: true,
          isActive: true,
          deletedAt: true,
          memberships: {
            where: { role: "owner" },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });
  if (!invite || invite.pod.deletedAt || !invite.pod.isActive) {
    return { status: "invalid", message: "This pod can no longer be claimed." };
  }
  if (invite.pod.memberships.length > 0 || invite.claimedAt) {
    return { status: "already_claimed", message: "This pod has already been claimed." };
  }
  if (invite.revokedAt) return { status: "revoked", message: "This claim link is no longer valid." };
  if (invite.expiresAt <= new Date()) {
    return {
      status: "expired",
      message: "This claim link has expired. Ask the Open Order team for a new invitation.",
    };
  }
  return {
    status: "active",
    podId: invite.pod.id,
    podName: invite.pod.name,
    address: invite.pod.address,
    invitedEmail: invite.invitedEmail,
    expiresAt: invite.expiresAt,
  };
}

export type AcceptPodClaimInviteResult =
  | { ok: true; podId: string; message: string }
  | {
      ok: false;
      code:
        | "invalid"
        | "expired"
        | "revoked"
        | "already_claimed"
        | "wrong_account"
        | "email_unverified"
        | "account_disabled"
        | "conflict";
      message: string;
    };

class ClaimRejected extends Error {
  constructor(
    readonly code: Exclude<AcceptPodClaimInviteResult, { ok: true }>["code"],
    message: string
  ) {
    super(message);
  }
}

export async function acceptPodClaimInvite(input: {
  rawToken: string;
  userId: string;
}): Promise<AcceptPodClaimInviteResult> {
  const token = normalizeSecureInviteTokenFromRequest(input.rawToken);
  if (!token) return { ok: false, code: "invalid", message: "This claim link is no longer valid." };
  const tokenHash = hashSecureInviteToken(token);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const accepted = await prisma.$transaction(
        async (tx) => {
          const [user, invite] = await Promise.all([
            tx.user.findUnique({
              where: { id: input.userId },
              select: {
                id: true,
                email: true,
                emailVerified: true,
                disabledAt: true,
                deletedAt: true,
              },
            }),
            tx.podClaimInvite.findUnique({
              where: { tokenHash },
              select: {
                id: true,
                invitedEmail: true,
                expiresAt: true,
                claimedAt: true,
                revokedAt: true,
                pod: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    isActive: true,
                    deletedAt: true,
                  },
                },
              },
            }),
          ]);

          if (!user) throw new ClaimRejected("invalid", "Sign in to claim this pod.");
          if (user.disabledAt || user.deletedAt) {
            throw new ClaimRejected("account_disabled", "This account is disabled.");
          }
          if (!invite || invite.pod.deletedAt || !invite.pod.isActive) {
            throw new ClaimRejected("invalid", "This pod can no longer be claimed.");
          }
          if (invite.claimedAt) {
            throw new ClaimRejected("already_claimed", "This pod has already been claimed.");
          }
          if (invite.revokedAt) {
            throw new ClaimRejected("revoked", "This claim link is no longer valid.");
          }
          if (invite.expiresAt <= new Date()) {
            throw new ClaimRejected(
              "expired",
              "This claim link has expired. Ask the Open Order team for a new invitation."
            );
          }
          if (normalizeAccountEmail(user.email) !== normalizeAccountEmail(invite.invitedEmail)) {
            throw new ClaimRejected(
              "wrong_account",
              `This invitation was sent to ${invite.invitedEmail}. Sign in with that email to claim the pod.`
            );
          }
          if (!user.emailVerified) {
            throw new ClaimRejected(
              "email_unverified",
              "Verify your email address before claiming this pod."
            );
          }

          const existingOwner = await tx.podMembership.findFirst({
            where: { podId: invite.pod.id, role: PodMembershipRole.owner },
            select: { id: true },
          });
          if (existingOwner) {
            throw new ClaimRejected("already_claimed", "This pod has already been claimed.");
          }

          const now = new Date();
          const consumed = await tx.podClaimInvite.updateMany({
            where: {
              id: invite.id,
              claimedAt: null,
              revokedAt: null,
              expiresAt: { gt: now },
            },
            data: { claimedAt: now, claimedByUserId: user.id },
          });
          if (consumed.count !== 1) {
            throw new ClaimRejected("conflict", "This claim link was already used.");
          }

          await tx.podMembership.upsert({
            where: { userId_podId: { userId: user.id, podId: invite.pod.id } },
            create: {
              userId: user.id,
              podId: invite.pod.id,
              role: PodMembershipRole.owner,
            },
            update: { role: PodMembershipRole.owner },
          });
          await tx.user.update({
            where: { id: user.id },
            data: {
              registrationIntent: RegistrationIntent.pod_owner,
              needsAccountRoleSelection: false,
            },
          });
          return {
            podId: invite.pod.id,
            podName: invite.pod.name,
            slug: invite.pod.slug,
            invitedEmail: invite.invitedEmail,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );

      await createAdminAuditLog({
        adminUserId: input.userId,
        actionType: ADMIN_AUDIT_ACTION.POD_CLAIMED,
        targetType: ADMIN_AUDIT_TARGET.pod,
        targetId: accepted.podId,
        reason: "Pod claim invitation accepted.",
        newValue: { ownerUserId: input.userId },
        metadata: {
          podId: accepted.podId,
          invitedEmail: accepted.invitedEmail,
          podName: accepted.podName,
        },
      });
      revalidateClaimAdminSurfaces(accepted.podId, accepted.slug);
      return {
        ok: true,
        podId: accepted.podId,
        message: "Pod claimed. You can now manage your pod, vendors, and sharing tools.",
      };
    } catch (error) {
      if (error instanceof ClaimRejected) {
        return { ok: false, code: error.code, message: error.message };
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        if (attempt < 2) continue;
        return {
          ok: false,
          code: "conflict",
          message: "This pod is being claimed by another request. Try again.",
        };
      }
      throw error;
    }
  }
  return { ok: false, code: "conflict", message: "Could not claim this pod." };
}

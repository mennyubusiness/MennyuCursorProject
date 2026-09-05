import "server-only";

import { revalidatePath } from "next/cache";
import { ADMIN_AUDIT_ACTION, ADMIN_AUDIT_TARGET, requireAdminReason } from "@/lib/admin-audit-log";
import {
  buildVendorClaimInviteUrl,
  generateSecureInviteToken,
  hashSecureInviteToken,
  normalizeSecureInviteTokenFromRequest,
  VENDOR_CLAIM_INVITE_TTL_MS,
} from "@/lib/auth/secure-invite-token";
import { normalizeAccountEmail, validateAccountEmail } from "@/lib/auth/password-policy";
import { prisma } from "@/lib/db";
import { sendVendorClaimInviteEmail } from "@/lib/email/vendor-claim-invite-email";
import { getPublicSiteOriginFromEnv } from "@/lib/public-site-url";
import { createAdminAuditLog } from "@/services/admin-audit-log.service";
import { Prisma, RegistrationIntent, VendorMembershipRole } from "@prisma/client";

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

async function loadClaimableVendor(vendorId: string) {
  return prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      id: true,
      name: true,
      isActive: true,
      deletedAt: true,
      pods: {
        take: 1,
        orderBy: { createdAt: "asc" },
        select: { pod: { select: { id: true, name: true } } },
      },
      vendorMemberships: {
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

function revalidateClaimAdminSurfaces(vendorId: string, podId?: string | null) {
  revalidatePath(`/admin/vendors/${vendorId}`);
  revalidatePath("/admin/vendors");
  if (podId) revalidatePath(`/admin/pods/${podId}`);
}

export async function sendVendorClaimInvite(input: {
  vendorId: string;
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

  const vendor = await loadClaimableVendor(input.vendorId);
  if (!vendor || vendor.deletedAt || !vendor.isActive) {
    return { ok: false, error: "This vendor can no longer be claimed." };
  }
  if (vendor.vendorMemberships.length > 0) {
    return { ok: false, error: "This vendor already has an owner." };
  }
  const now = new Date();
  const existingActive =
    vendor.claimInvite &&
    !vendor.claimInvite.claimedAt &&
    !vendor.claimInvite.revokedAt &&
    vendor.claimInvite.expiresAt > now;
  if (existingActive) {
    return { ok: false, error: "An active claim invitation already exists. Resend or revoke it." };
  }

  const rawToken = generateSecureInviteToken();
  const tokenHash = hashSecureInviteToken(rawToken);
  const expiresAt = new Date(now.getTime() + VENDOR_CLAIM_INVITE_TTL_MS);
  const invite = await prisma.vendorClaimInvite.upsert({
    where: { vendorId: vendor.id },
    create: {
      vendorId: vendor.id,
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

  const inviteUrl = buildVendorClaimInviteUrl(inviteOrigin(input.requestOrigin), rawToken);
  const pod = vendor.pods[0]?.pod ?? null;
  const email = await sendVendorClaimInviteEmail({
    to: invitedEmail,
    vendorName: vendor.name,
    podName: pod?.name ?? null,
    inviteUrl,
  });

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.VENDOR_CLAIM_INVITE_SENT,
    targetType: ADMIN_AUDIT_TARGET.vendor,
    targetId: vendor.id,
    reason: reasonCheck.reason,
    newValue: { inviteId: invite.id, invitedEmail, expiresAt: expiresAt.toISOString() },
    metadata: { vendorId: vendor.id, podId: pod?.id ?? null, invitedEmail },
  });
  revalidateClaimAdminSurfaces(vendor.id, pod?.id);

  return {
    ok: true,
    inviteId: invite.id,
    inviteUrl,
    emailStatus: email.status,
    message: `Claim invitation sent to ${invitedEmail}.`,
  };
}

export async function resendVendorClaimInvite(input: {
  vendorId: string;
  adminUserId: string | null;
  reason: string;
  requestOrigin?: string;
}): Promise<InviteActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;
  const vendor = await loadClaimableVendor(input.vendorId);
  if (!vendor || vendor.deletedAt || !vendor.isActive) {
    return { ok: false, error: "This vendor can no longer be claimed." };
  }
  if (vendor.vendorMemberships.length > 0) {
    return { ok: false, error: "This vendor already has an owner." };
  }
  if (!vendor.claimInvite || vendor.claimInvite.claimedAt) {
    return { ok: false, error: "There is no claim invitation to resend." };
  }

  const now = new Date();
  const rawToken = generateSecureInviteToken();
  const tokenHash = hashSecureInviteToken(rawToken);
  const expiresAt = new Date(now.getTime() + VENDOR_CLAIM_INVITE_TTL_MS);
  await prisma.vendorClaimInvite.update({
    where: { id: vendor.claimInvite.id },
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

  const inviteUrl = buildVendorClaimInviteUrl(inviteOrigin(input.requestOrigin), rawToken);
  const pod = vendor.pods[0]?.pod ?? null;
  const email = await sendVendorClaimInviteEmail({
    to: vendor.claimInvite.invitedEmail,
    vendorName: vendor.name,
    podName: pod?.name ?? null,
    inviteUrl,
  });
  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.VENDOR_CLAIM_INVITE_RESENT,
    targetType: ADMIN_AUDIT_TARGET.vendor,
    targetId: vendor.id,
    reason: reasonCheck.reason,
    newValue: {
      inviteId: vendor.claimInvite.id,
      invitedEmail: vendor.claimInvite.invitedEmail,
      expiresAt: expiresAt.toISOString(),
    },
    metadata: { vendorId: vendor.id, podId: pod?.id ?? null, invitedEmail: vendor.claimInvite.invitedEmail },
  });
  revalidateClaimAdminSurfaces(vendor.id, pod?.id);
  return {
    ok: true,
    inviteId: vendor.claimInvite.id,
    inviteUrl,
    emailStatus: email.status,
    message: `A new claim invitation was sent to ${vendor.claimInvite.invitedEmail}.`,
  };
}

export async function revokeVendorClaimInvite(input: {
  vendorId: string;
  adminUserId: string | null;
  reason: string;
}): Promise<InviteActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;
  const vendor = await loadClaimableVendor(input.vendorId);
  if (!vendor || !vendor.claimInvite) return { ok: false, error: "Claim invitation not found." };
  if (vendor.claimInvite.claimedAt) return { ok: false, error: "This invitation has already been used." };
  if (vendor.claimInvite.revokedAt) return { ok: false, error: "This invitation is already revoked." };

  await prisma.vendorClaimInvite.update({
    where: { id: vendor.claimInvite.id },
    data: { revokedAt: new Date() },
  });
  const pod = vendor.pods[0]?.pod ?? null;
  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.VENDOR_CLAIM_INVITE_REVOKED,
    targetType: ADMIN_AUDIT_TARGET.vendor,
    targetId: vendor.id,
    reason: reasonCheck.reason,
    oldValue: { inviteId: vendor.claimInvite.id, invitedEmail: vendor.claimInvite.invitedEmail },
    metadata: { vendorId: vendor.id, podId: pod?.id ?? null, invitedEmail: vendor.claimInvite.invitedEmail },
  });
  revalidateClaimAdminSurfaces(vendor.id, pod?.id);
  return {
    ok: true,
    inviteId: vendor.claimInvite.id,
    message: "Claim invitation revoked.",
  };
}

export type VendorClaimInvitePublicView =
  | {
      status: "active";
      vendorId: string;
      vendorName: string;
      podName: string | null;
      invitedEmail: string;
      expiresAt: Date;
    }
  | { status: "invalid" | "expired" | "revoked" | "already_claimed"; message: string };

export async function resolveVendorClaimInviteByToken(
  rawToken: string
): Promise<VendorClaimInvitePublicView> {
  const token = normalizeSecureInviteTokenFromRequest(rawToken);
  if (!token) return { status: "invalid", message: "This claim link is no longer valid." };
  const invite = await prisma.vendorClaimInvite.findUnique({
    where: { tokenHash: hashSecureInviteToken(token) },
    select: {
      invitedEmail: true,
      expiresAt: true,
      claimedAt: true,
      revokedAt: true,
      vendor: {
        select: {
          id: true,
          name: true,
          isActive: true,
          deletedAt: true,
          vendorMemberships: {
            where: { role: "owner" },
            select: { id: true },
            take: 1,
          },
          pods: {
            take: 1,
            orderBy: { createdAt: "asc" },
            select: { pod: { select: { name: true } } },
          },
        },
      },
    },
  });
  if (!invite || invite.vendor.deletedAt || !invite.vendor.isActive) {
    return { status: "invalid", message: "This vendor can no longer be claimed." };
  }
  if (invite.vendor.vendorMemberships.length > 0 || invite.claimedAt) {
    return { status: "already_claimed", message: "This vendor has already been claimed." };
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
    vendorId: invite.vendor.id,
    vendorName: invite.vendor.name,
    podName: invite.vendor.pods[0]?.pod.name ?? null,
    invitedEmail: invite.invitedEmail,
    expiresAt: invite.expiresAt,
  };
}

export type AcceptVendorClaimInviteResult =
  | { ok: true; vendorId: string; message: string }
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
    readonly code: Exclude<AcceptVendorClaimInviteResult, { ok: true }>["code"],
    message: string
  ) {
    super(message);
  }
}

export async function acceptVendorClaimInvite(input: {
  rawToken: string;
  userId: string;
}): Promise<AcceptVendorClaimInviteResult> {
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
            tx.vendorClaimInvite.findUnique({
              where: { tokenHash },
              select: {
                id: true,
                invitedEmail: true,
                expiresAt: true,
                claimedAt: true,
                revokedAt: true,
                vendor: {
                  select: {
                    id: true,
                    name: true,
                    isActive: true,
                    deletedAt: true,
                    pods: {
                      take: 1,
                      orderBy: { createdAt: "asc" },
                      select: { podId: true },
                    },
                  },
                },
              },
            }),
          ]);

          if (!user) throw new ClaimRejected("invalid", "Sign in to claim this vendor.");
          if (user.disabledAt || user.deletedAt) {
            throw new ClaimRejected("account_disabled", "This account is disabled.");
          }
          if (!invite || invite.vendor.deletedAt || !invite.vendor.isActive) {
            throw new ClaimRejected("invalid", "This vendor can no longer be claimed.");
          }
          if (invite.claimedAt) {
            throw new ClaimRejected("already_claimed", "This vendor has already been claimed.");
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
              `This invitation was sent to ${invite.invitedEmail}. Sign in with that email to claim the vendor.`
            );
          }
          if (!user.emailVerified) {
            throw new ClaimRejected(
              "email_unverified",
              "Verify your email address before claiming this vendor."
            );
          }

          const existingOwner = await tx.vendorMembership.findFirst({
            where: { vendorId: invite.vendor.id, role: VendorMembershipRole.owner },
            select: { id: true },
          });
          if (existingOwner) {
            throw new ClaimRejected("already_claimed", "This vendor has already been claimed.");
          }

          const now = new Date();
          const consumed = await tx.vendorClaimInvite.updateMany({
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

          await tx.vendorMembership.upsert({
            where: { userId_vendorId: { userId: user.id, vendorId: invite.vendor.id } },
            create: {
              userId: user.id,
              vendorId: invite.vendor.id,
              role: VendorMembershipRole.owner,
            },
            update: { role: VendorMembershipRole.owner },
          });
          await tx.user.update({
            where: { id: user.id },
            data: {
              registrationIntent: RegistrationIntent.vendor,
              needsAccountRoleSelection: false,
            },
          });
          return {
            vendorId: invite.vendor.id,
            vendorName: invite.vendor.name,
            podId: invite.vendor.pods[0]?.podId ?? null,
            invitedEmail: invite.invitedEmail,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );

      await createAdminAuditLog({
        adminUserId: input.userId,
        actionType: ADMIN_AUDIT_ACTION.VENDOR_CLAIMED,
        targetType: ADMIN_AUDIT_TARGET.vendor,
        targetId: accepted.vendorId,
        reason: "Vendor claim invitation accepted.",
        newValue: { ownerUserId: input.userId },
        metadata: {
          vendorId: accepted.vendorId,
          podId: accepted.podId,
          invitedEmail: accepted.invitedEmail,
          vendorName: accepted.vendorName,
        },
      });
      revalidateClaimAdminSurfaces(accepted.vendorId, accepted.podId);
      revalidatePath(`/vendor/${accepted.vendorId}/dashboard`);
      revalidatePath(`/vendor/${accepted.vendorId}/menu`);
      return {
        ok: true,
        vendorId: accepted.vendorId,
        message: "Vendor claimed. You can now manage your menu, hours, and profile.",
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
          message: "This vendor is being claimed by another request. Try again.",
        };
      }
      throw error;
    }
  }
  return { ok: false, code: "conflict", message: "Could not claim this vendor." };
}

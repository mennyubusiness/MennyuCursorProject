import "server-only";

import { normalizeAccountEmail, validateAccountEmail } from "@/lib/auth/password-policy";
import {
  buildPodVendorInviteUrl,
  generateSecureInviteToken,
  hashSecureInviteToken,
  POD_VENDOR_INVITE_TTL_MS,
} from "@/lib/auth/secure-invite-token";
import { attachVendorToPod } from "@/lib/attach-vendor-to-pod";
import { getPublicSiteOriginFromEnv } from "@/lib/public-site-url";
import { prisma } from "@/lib/db";
import { sendPodVendorInviteEmail } from "@/lib/email/pod-vendor-invite-email";
import type { PodVendorInvitePublicView } from "@/services/pod-vendor-invite.types";

export { type PodVendorInvitePublicView };

export const POD_VENDOR_INVITE_STATUS = {
  pending: "pending",
  accepted: "accepted",
  cancelled: "cancelled",
  expired: "expired",
} as const;

export type CreatePodVendorInviteInput = {
  podId: string;
  createdByUserId: string;
  invitedEmail: string;
  invitedVendorName?: string | null;
  invitedContactName?: string | null;
  invitedPhone?: string | null;
  note?: string | null;
  targetVendorId?: string | null;
  sendEmail?: boolean;
  requestOrigin?: string;
};

export type CreatePodVendorInviteResult =
  | {
      ok: true;
      inviteId: string;
      inviteUrl: string;
      emailStatus: string;
    }
  | { ok: false; error: string };

export type AcceptPodVendorInviteResult =
  | { ok: true; vendorId: string; podId: string; podName: string; alreadyAccepted: boolean }
  | {
      ok: false;
      code:
        | "invalid"
        | "expired"
        | "cancelled"
        | "email_mismatch"
        | "no_vendor_account"
        | "wrong_vendor"
        | "vendor_in_other_pod"
        | "not_signed_in";
      message: string;
      invitedEmail?: string;
      currentEmail?: string;
    };

function inviteOrigin(requestOrigin?: string): string {
  const fromEnv = getPublicSiteOriginFromEnv();
  if (process.env.PUBLIC_APP_URL?.trim() || process.env.NEXTAUTH_URL?.trim()) {
    return fromEnv.replace(/\/$/, "");
  }
  return (requestOrigin ?? fromEnv).replace(/\/$/, "");
}

export async function resolvePodVendorInviteByToken(rawToken: string): Promise<PodVendorInvitePublicView> {
  const token = rawToken.trim();
  if (!token) return { ok: false, reason: "invalid" };

  const tokenHash = hashSecureInviteToken(token);
  const invite = await prisma.podVendorInvite.findUnique({
    where: { tokenHash },
    include: { pod: { select: { id: true, name: true } } },
  });
  if (!invite) return { ok: false, reason: "invalid" };

  let status = invite.status;
  if (status === POD_VENDOR_INVITE_STATUS.pending && invite.expiresAt.getTime() < Date.now()) {
    status = POD_VENDOR_INVITE_STATUS.expired;
  }

  if (status === POD_VENDOR_INVITE_STATUS.pending) {
    return {
      ok: true,
      status: "pending",
      podId: invite.podId,
      podName: invite.pod.name,
      invitedVendorName: invite.invitedVendorName,
      invitedEmail: invite.invitedEmail,
      expiresAt: invite.expiresAt.toISOString(),
    };
  }

  return {
    ok: true,
    status: status as "accepted" | "cancelled" | "expired",
    podName: invite.pod.name,
    invitedVendorName: invite.invitedVendorName,
  };
}

export async function createPodVendorInvite(
  input: CreatePodVendorInviteInput
): Promise<CreatePodVendorInviteResult> {
  const emailError = validateAccountEmail(input.invitedEmail);
  if (emailError) return { ok: false, error: emailError };

  const invitedEmail = normalizeAccountEmail(input.invitedEmail);
  const invitedVendorName = input.invitedVendorName?.trim() || null;
  const invitedContactName = input.invitedContactName?.trim() || null;
  const invitedPhone = input.invitedPhone?.trim() || null;
  const note = input.note?.trim() || null;
  const targetVendorId = input.targetVendorId?.trim() || null;

  const pod = await prisma.pod.findUnique({
    where: { id: input.podId },
    select: { id: true, name: true },
  });
  if (!pod) return { ok: false, error: "Pod not found." };

  if (targetVendorId) {
    const vendor = await prisma.vendor.findUnique({
      where: { id: targetVendorId },
      select: { id: true, contactEmail: true },
    });
    if (!vendor) return { ok: false, error: "Vendor not found." };

    const inPod = await prisma.podVendor.findUnique({
      where: { podId_vendorId: { podId: input.podId, vendorId: targetVendorId } },
    });
    if (inPod) return { ok: false, error: "This vendor is already in your pod." };

    const existingPendingInvite = await prisma.podVendorInvite.findFirst({
      where: {
        podId: input.podId,
        targetVendorId,
        status: POD_VENDOR_INVITE_STATUS.pending,
        expiresAt: { gt: new Date() },
      },
    });
    if (existingPendingInvite) {
      return { ok: false, error: "A pending invite for this vendor already exists." };
    }
  } else {
    const existingPendingInvite = await prisma.podVendorInvite.findFirst({
      where: {
        podId: input.podId,
        invitedEmail,
        status: POD_VENDOR_INVITE_STATUS.pending,
        expiresAt: { gt: new Date() },
      },
    });
    if (existingPendingInvite) {
      return { ok: false, error: "A pending invite for this email already exists." };
    }
  }

  const rawToken = generateSecureInviteToken();
  const tokenHash = hashSecureInviteToken(rawToken);
  const expiresAt = new Date(Date.now() + POD_VENDOR_INVITE_TTL_MS);
  const now = new Date();

  let membershipRequestId: string | null = null;
  if (targetVendorId) {
    const existingRequest = await prisma.podMembershipRequest.findFirst({
      where: { podId: input.podId, vendorId: targetVendorId, status: "pending" },
    });
    if (existingRequest) {
      membershipRequestId = existingRequest.id;
    } else {
      const req = await prisma.podMembershipRequest.create({
        data: {
          podId: input.podId,
          vendorId: targetVendorId,
          status: "pending",
          requestedBy: input.createdByUserId,
        },
      });
      membershipRequestId = req.id;
    }
  }

  const invite = await prisma.podVendorInvite.create({
    data: {
      podId: input.podId,
      invitedEmail,
      invitedVendorName,
      invitedContactName,
      invitedPhone,
      note,
      tokenHash,
      status: POD_VENDOR_INVITE_STATUS.pending,
      expiresAt,
      createdByUserId: input.createdByUserId,
      targetVendorId,
      membershipRequestId,
      lastSentAt: now,
    },
  });

  const inviteUrl = buildPodVendorInviteUrl(inviteOrigin(input.requestOrigin), rawToken);

  let emailStatus = "skipped";
  if (input.sendEmail !== false) {
    const emailResult = await sendPodVendorInviteEmail({
      to: invitedEmail,
      podName: pod.name,
      vendorName: invitedVendorName,
      inviteUrl,
    });
    emailStatus = emailResult.status;
  }

  return { ok: true, inviteId: invite.id, inviteUrl, emailStatus };
}

export async function resendPodVendorInvite(input: {
  podId: string;
  inviteId: string;
  requestOrigin?: string;
}): Promise<CreatePodVendorInviteResult | { ok: false; error: string }> {
  const invite = await prisma.podVendorInvite.findFirst({
    where: { id: input.inviteId, podId: input.podId },
    include: { pod: { select: { name: true } } },
  });
  if (!invite) return { ok: false, error: "Invite not found." };
  if (invite.status !== POD_VENDOR_INVITE_STATUS.pending) {
    return { ok: false, error: "Only pending invites can be resent." };
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    await prisma.podVendorInvite.update({
      where: { id: invite.id },
      data: { status: POD_VENDOR_INVITE_STATUS.expired, updatedAt: new Date() },
    });
    return { ok: false, error: "This invite has expired. Send a new invite." };
  }

  const rawToken = generateSecureInviteToken();
  const tokenHash = hashSecureInviteToken(rawToken);
  const now = new Date();

  await prisma.podVendorInvite.update({
    where: { id: invite.id },
    data: { tokenHash, lastSentAt: now, updatedAt: now },
  });

  const inviteUrl = buildPodVendorInviteUrl(inviteOrigin(input.requestOrigin), rawToken);
  const emailResult = await sendPodVendorInviteEmail({
    to: invite.invitedEmail,
    podName: invite.pod.name,
    vendorName: invite.invitedVendorName,
    inviteUrl,
  });

  return { ok: true, inviteId: invite.id, inviteUrl, emailStatus: emailResult.status };
}

export async function cancelPodVendorInvite(podId: string, inviteId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const invite = await prisma.podVendorInvite.findFirst({
    where: { id: inviteId, podId },
  });
  if (!invite) return { ok: false, error: "Invite not found." };
  if (invite.status !== POD_VENDOR_INVITE_STATUS.pending) {
    return { ok: false, error: "Only pending invites can be cancelled." };
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.podVendorInvite.update({
      where: { id: inviteId },
      data: { status: POD_VENDOR_INVITE_STATUS.cancelled, updatedAt: now },
    });
    if (invite.membershipRequestId) {
      await tx.podMembershipRequest.updateMany({
        where: { id: invite.membershipRequestId, status: "pending" },
        data: { status: "cancelled", updatedAt: now },
      });
    } else if (invite.targetVendorId) {
      await tx.podMembershipRequest.updateMany({
        where: { podId, vendorId: invite.targetVendorId, status: "pending" },
        data: { status: "cancelled", updatedAt: now },
      });
    }
  });

  return { ok: true };
}

async function resolveVendorForInviteAcceptance(input: {
  userId: string;
  userEmail: string;
  targetVendorId: string | null;
}): Promise<
  | { vendorId: string }
  | {
      error: string;
      code: "no_vendor_account" | "wrong_vendor";
    }
> {
  const memberships = await prisma.vendorMembership.findMany({
    where: { userId: input.userId },
    select: { vendorId: true, role: true },
    orderBy: { createdAt: "asc" },
  });

  if (input.targetVendorId) {
    const match = memberships.find((m) => m.vendorId === input.targetVendorId);
    if (!match) {
      return { error: "This invite is for a different vendor account.", code: "wrong_vendor" };
    }
    return { vendorId: input.targetVendorId };
  }

  if (memberships.length === 1) {
    return { vendorId: memberships[0]!.vendorId };
  }

  if (memberships.length > 1) {
    const byEmail = await prisma.vendor.findFirst({
      where: {
        id: { in: memberships.map((m) => m.vendorId) },
        contactEmail: { equals: input.userEmail, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (byEmail) return { vendorId: byEmail.id };
    return { error: "Select a vendor account to connect to this pod.", code: "no_vendor_account" };
  }

  return { error: "Create a vendor account to accept this invite.", code: "no_vendor_account" };
}

export async function acceptPodVendorInvite(input: {
  rawToken: string;
  userId: string;
  userEmail: string;
}): Promise<AcceptPodVendorInviteResult> {
  const userEmail = normalizeAccountEmail(input.userEmail);
  const token = input.rawToken.trim();
  if (!token) {
    return { ok: false, code: "invalid", message: "This invite link is not valid." };
  }

  const tokenHash = hashSecureInviteToken(token);
  const invite = await prisma.podVendorInvite.findUnique({
    where: { tokenHash },
    include: { pod: { select: { id: true, name: true } } },
  });

  if (!invite) {
    return { ok: false, code: "invalid", message: "This invite link is not valid." };
  }

  if (invite.status === POD_VENDOR_INVITE_STATUS.cancelled) {
    return { ok: false, code: "cancelled", message: "This invite was cancelled. Ask the pod owner for a new invite." };
  }

  if (invite.status === POD_VENDOR_INVITE_STATUS.accepted) {
    if (invite.acceptedVendorId) {
      return {
        ok: true,
        vendorId: invite.acceptedVendorId,
        podId: invite.podId,
        podName: invite.pod.name,
        alreadyAccepted: true,
      };
    }
    return { ok: false, code: "invalid", message: "This invite has already been used." };
  }

  if (invite.expiresAt.getTime() < Date.now()) {
    await prisma.podVendorInvite.update({
      where: { id: invite.id },
      data: { status: POD_VENDOR_INVITE_STATUS.expired, updatedAt: new Date() },
    });
    return { ok: false, code: "expired", message: "This invite has expired. Ask the pod owner for a new invite." };
  }

  if (normalizeAccountEmail(invite.invitedEmail) !== userEmail) {
    return {
      ok: false,
      code: "email_mismatch",
      message: `This invite was sent to ${invite.invitedEmail}. You are signed in as ${userEmail}. Please sign in with the invited email to continue.`,
      invitedEmail: invite.invitedEmail,
      currentEmail: userEmail,
    };
  }

  const vendorResolution = await resolveVendorForInviteAcceptance({
    userId: input.userId,
    userEmail,
    targetVendorId: invite.targetVendorId,
  });
  if ("error" in vendorResolution) {
    return { ok: false, code: vendorResolution.code, message: vendorResolution.error };
  }

  const vendorInOtherPod = await prisma.podVendor.findFirst({
    where: { vendorId: vendorResolution.vendorId },
    select: { podId: true },
  });
  if (vendorInOtherPod && vendorInOtherPod.podId !== invite.podId) {
    const attach = await attachVendorToPod(invite.podId, vendorResolution.vendorId);
    if (!attach.ok) {
      return { ok: false, code: "vendor_in_other_pod", message: attach.error };
    }
  } else {
    const attach = await attachVendorToPod(invite.podId, vendorResolution.vendorId);
    if (!attach.ok) {
      return { ok: false, code: "invalid", message: attach.error };
    }
  }

  const now = new Date();
  await prisma.podVendorInvite.update({
    where: { id: invite.id },
    data: {
      status: POD_VENDOR_INVITE_STATUS.accepted,
      acceptedAt: now,
      acceptedByUserId: input.userId,
      acceptedVendorId: vendorResolution.vendorId,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    vendorId: vendorResolution.vendorId,
    podId: invite.podId,
    podName: invite.pod.name,
    alreadyAccepted: false,
  };
}

export async function listPendingPodVendorInvites(podId: string) {
  const now = new Date();
  const invites = await prisma.podVendorInvite.findMany({
    where: {
      podId,
      status: POD_VENDOR_INVITE_STATUS.pending,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      invitedEmail: true,
      invitedVendorName: true,
      invitedContactName: true,
      targetVendorId: true,
      lastSentAt: true,
      createdAt: true,
      expiresAt: true,
    },
  });

  return invites.map((invite) => ({
    id: invite.id,
    invitedEmail: invite.invitedEmail,
    invitedVendorName: invite.invitedVendorName,
    invitedContactName: invite.invitedContactName,
    targetVendorId: invite.targetVendorId,
    lastSentAt: invite.lastSentAt?.toISOString() ?? invite.createdAt.toISOString(),
    createdAt: invite.createdAt.toISOString(),
    expiresAt: invite.expiresAt.toISOString(),
  }));
}

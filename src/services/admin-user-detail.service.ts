import "server-only";

import { prisma } from "@/lib/db";
import { POD_VENDOR_INVITE_STATUS } from "@/services/pod-vendor-invite.service";
import { listAdminAuditLogsForUser } from "@/services/admin-audit-log.service";

export type AdminUserInviteRow = {
  id: string;
  status: string;
  invitedEmail: string;
  podId: string;
  podName: string;
  vendorName: string | null;
  targetVendorId: string | null;
  acceptedVendorId: string | null;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  acceptedByUserId: string | null;
  createdByEmail: string | null;
  attachmentMissing: boolean;
  attachmentWarning: string | null;
};

export type AdminUserDetailView = {
  user: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    createdAt: string;
    updatedAt: string;
    emailVerified: boolean;
    emailVerifiedAt: string | null;
    phoneVerified: boolean;
    phoneVerifiedAt: string | null;
    disabledAt: string | null;
    isPlatformAdmin: boolean;
    registrationIntent: string | null;
    needsAccountRoleSelection: boolean;
    hasPassword: boolean;
    lastLoginLabel: string;
    authProviderLabel: string;
  };
  vendors: Array<{
    vendorId: string;
    vendorName: string;
    role: string;
    podName: string | null;
    podId: string | null;
  }>;
  pods: Array<{
    podId: string;
    podName: string;
    role: string;
  }>;
  customer: {
    hasProfile: boolean;
    hasLinkedPhoneAccount: boolean;
  };
  recentOrders: Array<{
    id: string;
    createdAt: string;
    status: string;
    totalCents: number;
    podName: string;
  }>;
  invites: AdminUserInviteRow[];
  auditLogs: Array<{
    id: string;
    actionType: string;
    targetType: string;
    targetId: string;
    reason: string | null;
    oldValue: string | null;
    newValue: string | null;
    createdAt: string;
    adminEmail: string | null;
  }>;
};

async function inviteAttachmentState(invite: {
  podId: string;
  status: string;
  acceptedVendorId: string | null;
}): Promise<{ attachmentMissing: boolean; attachmentWarning: string | null }> {
  if (invite.status !== POD_VENDOR_INVITE_STATUS.accepted || !invite.acceptedVendorId) {
    return { attachmentMissing: false, attachmentWarning: null };
  }
  const podVendor = await prisma.podVendor.findFirst({
    where: { podId: invite.podId, vendorId: invite.acceptedVendorId },
    select: { id: true },
  });
  if (podVendor) {
    return { attachmentMissing: false, attachmentWarning: null };
  }
  return {
    attachmentMissing: true,
    attachmentWarning: "Invite accepted, but expected pod/vendor relationship is missing.",
  };
}

export async function loadAdminUserDetail(userId: string): Promise<AdminUserDetailView | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      customerProfile: true,
      customerAccount: true,
      vendorMemberships: {
        include: {
          vendor: {
            select: {
              id: true,
              name: true,
              pods: { include: { pod: { select: { id: true, name: true } } }, take: 1 },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      podMemberships: {
        include: { pod: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!user) return null;

  const emailNorm = user.email.toLowerCase();
  const [recentOrders, inviteRows, auditRows] = await Promise.all([
    user.customerAccount
      ? prisma.order.findMany({
          where: { customerAccountId: user.customerAccount.id },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            createdAt: true,
            status: true,
            totalCents: true,
            pod: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    prisma.podVendorInvite.findMany({
      where: {
        OR: [
          { invitedEmail: { equals: emailNorm, mode: "insensitive" } },
          { acceptedByUserId: userId },
          { createdByUserId: userId },
        ],
      },
      include: {
        pod: { select: { id: true, name: true } },
        createdByUser: { select: { email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    listAdminAuditLogsForUser(userId, 30),
  ]);

  const invites: AdminUserInviteRow[] = [];
  for (const invite of inviteRows) {
    const attachment = await inviteAttachmentState(invite);
    invites.push({
      id: invite.id,
      status: invite.status,
      invitedEmail: invite.invitedEmail,
      podId: invite.podId,
      podName: invite.pod.name,
      vendorName: invite.invitedVendorName,
      targetVendorId: invite.targetVendorId,
      acceptedVendorId: invite.acceptedVendorId,
      createdAt: invite.createdAt.toISOString(),
      expiresAt: invite.expiresAt.toISOString(),
      acceptedAt: invite.acceptedAt?.toISOString() ?? null,
      acceptedByUserId: invite.acceptedByUserId,
      createdByEmail: invite.createdByUser.email,
      ...attachment,
    });
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.customerAccount?.phoneE164 ?? user.customerProfile?.phone ?? null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      emailVerified: Boolean(user.emailVerified),
      emailVerifiedAt: user.emailVerified?.toISOString() ?? null,
      phoneVerified: Boolean(user.customerAccount?.phoneVerifiedAt),
      phoneVerifiedAt: user.customerAccount?.phoneVerifiedAt?.toISOString() ?? null,
      disabledAt: user.disabledAt?.toISOString() ?? null,
      isPlatformAdmin: user.isPlatformAdmin,
      registrationIntent: user.registrationIntent,
      needsAccountRoleSelection: user.needsAccountRoleSelection,
      hasPassword: Boolean(user.passwordHash),
      lastLoginLabel: "Not tracked",
      authProviderLabel: user.passwordHash ? "Email + password" : "No password set",
    },
    vendors: user.vendorMemberships.map((m) => ({
      vendorId: m.vendor.id,
      vendorName: m.vendor.name,
      role: m.role,
      podId: m.vendor.pods[0]?.pod.id ?? null,
      podName: m.vendor.pods[0]?.pod.name ?? null,
    })),
    pods: user.podMemberships.map((m) => ({
      podId: m.pod.id,
      podName: m.pod.name,
      role: m.role,
    })),
    customer: {
      hasProfile: Boolean(user.customerProfile),
      hasLinkedPhoneAccount: Boolean(user.customerAccount),
    },
    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      createdAt: o.createdAt.toISOString(),
      status: o.status,
      totalCents: o.totalCents,
      podName: o.pod.name,
    })),
    invites,
    auditLogs: auditRows.map((row) => ({
      id: row.id,
      actionType: row.actionType,
      targetType: row.targetType,
      targetId: row.targetId,
      reason: row.reason,
      oldValue: row.oldValue,
      newValue: row.newValue,
      createdAt: row.createdAt.toISOString(),
      adminEmail: row.adminUser?.email ?? null,
    })),
  };
}

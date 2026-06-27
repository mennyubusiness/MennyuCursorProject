import "server-only";

import { normalizeAccountEmail } from "@/lib/auth/password-policy";
import { prisma } from "@/lib/db";
import type { PodMembershipRole, VendorMembershipRole } from "@prisma/client";

export type AdminUserSearchRow = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  roleSummary: string;
  accountStatus: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: string;
  lastLoginLabel: string;
  vendorNames: string[];
  podNames: string[];
  recentOrderCount: number;
};

function roleSummary(input: {
  isPlatformAdmin: boolean;
  registrationIntent: string | null;
  vendorCount: number;
  podCount: number;
  hasCustomerProfile: boolean;
}): string {
  const parts: string[] = [];
  if (input.isPlatformAdmin) parts.push("Platform admin");
  if (input.registrationIntent) parts.push(input.registrationIntent.replace("_", " "));
  if (input.vendorCount > 0) parts.push(`${input.vendorCount} vendor${input.vendorCount === 1 ? "" : "s"}`);
  if (input.podCount > 0) parts.push(`${input.podCount} pod${input.podCount === 1 ? "" : "s"}`);
  if (input.hasCustomerProfile) parts.push("Customer profile");
  return parts.length > 0 ? parts.join(" · ") : "No roles";
}

function accountStatus(disabledAt: Date | null, emailVerified: Date | null): string {
  if (disabledAt) return "Disabled";
  if (!emailVerified) return "Email unverified";
  return "Active";
}

async function findUserIdsByOrderQuery(q: string): Promise<string[]> {
  const order = await prisma.order.findUnique({
    where: { id: q },
    select: { customerAccount: { select: { userId: true } } },
  });
  if (order?.customerAccount?.userId) return [order.customerAccount.userId];
  return [];
}

async function findUserIdsByInviteEmail(email: string): Promise<string[]> {
  const invites = await prisma.podVendorInvite.findMany({
    where: { invitedEmail: { equals: email, mode: "insensitive" } },
    select: { acceptedByUserId: true, createdByUserId: true },
    take: 50,
  });
  const ids = new Set<string>();
  for (const invite of invites) {
    if (invite.acceptedByUserId) ids.add(invite.acceptedByUserId);
    ids.add(invite.createdByUserId);
  }
  return [...ids];
}

export async function searchAdminUsers(rawQuery: string, limit = 50): Promise<AdminUserSearchRow[]> {
  const q = rawQuery.trim();
  if (!q) return [];

  const normalizedEmail = q.includes("@") ? normalizeAccountEmail(q) : null;
  const phoneDigits = q.replace(/\D/g, "");

  const idCandidates = new Set<string>();
  if (q.length >= 20) {
    idCandidates.add(q);
    for (const id of await findUserIdsByOrderQuery(q)) idCandidates.add(id);
  }
  if (normalizedEmail) {
    for (const id of await findUserIdsByInviteEmail(normalizedEmail)) idCandidates.add(id);
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [
        ...(idCandidates.size > 0 ? [{ id: { in: [...idCandidates] } }] : []),
        ...(normalizedEmail
          ? [{ email: { equals: normalizedEmail, mode: "insensitive" as const } }]
          : [{ email: { contains: q, mode: "insensitive" as const } }]),
        { name: { contains: q, mode: "insensitive" } },
        ...(phoneDigits.length >= 7
          ? [
              { customerProfile: { phone: { contains: phoneDigits } } },
              { customerAccount: { phoneE164: { contains: phoneDigits } } },
            ]
          : []),
        {
          vendorMemberships: {
            some: { vendor: { name: { contains: q, mode: "insensitive" } } },
          },
        },
        {
          podMemberships: {
            some: { pod: { name: { contains: q, mode: "insensitive" } } },
          },
        },
      ],
    },
    include: {
      vendorMemberships: {
        include: { vendor: { select: { name: true } } },
        take: 5,
      },
      podMemberships: {
        include: { pod: { select: { name: true } } },
        take: 5,
      },
      customerProfile: { select: { phone: true } },
      customerAccount: { select: { phoneE164: true, phoneVerifiedAt: true } },
      _count: {
        select: {
          vendorMemberships: true,
          podMemberships: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const userIds = users.map((u) => u.id);
  const accounts = await prisma.customerAccount.findMany({
    where: { userId: { in: userIds } },
    select: { id: true, userId: true },
  });
  const accountIds = accounts.map((a) => a.id);
  const orderCountsByAccountId = new Map<string, number>();
  if (accountIds.length > 0) {
    const grouped = await prisma.order.groupBy({
      by: ["customerAccountId"],
      where: {
        customerAccountId: { in: accountIds },
        createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
      },
      _count: { _all: true },
    });
    for (const row of grouped) {
      if (row.customerAccountId) {
        orderCountsByAccountId.set(row.customerAccountId, row._count._all);
      }
    }
  }
  const orderCountByUserId = new Map<string, number>();
  for (const account of accounts) {
    if (account.userId) {
      orderCountByUserId.set(account.userId, orderCountsByAccountId.get(account.id) ?? 0);
    }
  }

  return users.map((user) => {
    const phone = user.customerAccount?.phoneE164 ?? user.customerProfile?.phone ?? null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone,
      roleSummary: roleSummary({
        isPlatformAdmin: user.isPlatformAdmin,
        registrationIntent: user.registrationIntent,
        vendorCount: user._count.vendorMemberships,
        podCount: user._count.podMemberships,
        hasCustomerProfile: Boolean(user.customerProfile),
      }),
      accountStatus: accountStatus(user.disabledAt, user.emailVerified),
      emailVerified: Boolean(user.emailVerified),
      phoneVerified: Boolean(user.customerAccount?.phoneVerifiedAt),
      createdAt: user.createdAt.toISOString(),
      lastLoginLabel: "Not tracked",
      vendorNames: user.vendorMemberships.map((m) => m.vendor.name),
      podNames: user.podMemberships.map((m) => m.pod.name),
      recentOrderCount: orderCountByUserId.get(user.id) ?? 0,
    };
  });
}

export type { VendorMembershipRole, PodMembershipRole };

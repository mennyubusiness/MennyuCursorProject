/**
 * Pod payout settings persistence and admin read helpers.
 */
import "server-only";

import { prisma } from "@/lib/db";
import {
  type PodPayoutSettingsValidationContext,
  type UpdatePodPayoutSettingsInput,
  validateUpdatePodPayoutSettingsInput,
} from "@/lib/pod-payout-settings";

export type PodPayoutRecipientOption = {
  userId: string;
  role: "owner" | "manager";
  displayName: string;
  email: string;
};

export type PodPayoutAllocationStatusSummary = {
  count: number;
  amountCents: number;
};

export type PodPayoutAllocationSummary = {
  pending: PodPayoutAllocationStatusSummary;
  blocked: PodPayoutAllocationStatusSummary;
  cancelledDueToRefund: PodPayoutAllocationStatusSummary;
  blockedPartialRefundReview: PodPayoutAllocationStatusSummary;
  other: PodPayoutAllocationStatusSummary;
  total: PodPayoutAllocationStatusSummary;
};

export async function getPodOwnerUserIds(podId: string): Promise<string[]> {
  const owners = await prisma.podMembership.findMany({
    where: { podId, role: "owner" },
    select: { userId: true },
    orderBy: { createdAt: "asc" },
  });
  return owners.map((o) => o.userId);
}

/**
 * Recipient picker: pod owners first (beta policy — only owners are valid recipients).
 */
export async function getPodPayoutRecipientOptions(podId: string): Promise<PodPayoutRecipientOption[]> {
  const memberships = await prisma.podMembership.findMany({
    where: { podId, role: "owner" },
    select: {
      role: true,
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return memberships.map((m) => ({
    userId: m.user.id,
    role: m.role,
    displayName: m.user.name?.trim() || m.user.email,
    email: m.user.email,
  }));
}

export async function upsertPodPayoutSettings(
  input: UpdatePodPayoutSettingsInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const pod = await prisma.pod.findUnique({
    where: { id: input.podId },
    select: { id: true },
  });
  if (!pod) {
    return { ok: false, error: "Pod not found." };
  }

  const podOwnerUserIds = await getPodOwnerUserIds(input.podId);
  const validation = validateUpdatePodPayoutSettingsInput(input, { podOwnerUserIds });
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }

  const { normalized } = validation;

  await prisma.podPayoutSettings.upsert({
    where: { podId: input.podId },
    create: {
      podId: input.podId,
      ...normalized,
    },
    update: normalized,
  });

  return { ok: true };
}

export async function getPodPayoutAllocationSummary(podId: string): Promise<PodPayoutAllocationSummary> {
  const rows = await prisma.podPayoutAllocation.groupBy({
    by: ["status"],
    where: { podId },
    _count: true,
    _sum: { podPayoutAmountCents: true },
  });

  const empty = (): PodPayoutAllocationStatusSummary => ({ count: 0, amountCents: 0 });
  const summary: PodPayoutAllocationSummary = {
    pending: empty(),
    blocked: empty(),
    cancelledDueToRefund: empty(),
    blockedPartialRefundReview: empty(),
    other: empty(),
    total: empty(),
  };

  for (const row of rows) {
    const bucket: PodPayoutAllocationStatusSummary = {
      count: row._count,
      amountCents: row._sum.podPayoutAmountCents ?? 0,
    };
    summary.total.count += bucket.count;
    summary.total.amountCents += bucket.amountCents;

    switch (row.status) {
      case "pending":
        summary.pending = bucket;
        break;
      case "blocked":
        summary.blocked = bucket;
        break;
      case "cancelled_due_to_refund":
        summary.cancelledDueToRefund = bucket;
        break;
      case "blocked_partial_refund_review":
        summary.blockedPartialRefundReview = bucket;
        break;
      default:
        summary.other.count += bucket.count;
        summary.other.amountCents += bucket.amountCents;
    }
  }

  return summary;
}

export type AdminPodPayoutSettingsView = {
  podPayoutsEnabled: boolean;
  podRevenueShareBps: number;
  podPayoutRecipientUserId: string | null;
  minimumPayoutCents: number;
} | null;

export async function getPodPayoutSettingsForAdmin(podId: string): Promise<AdminPodPayoutSettingsView> {
  return prisma.podPayoutSettings.findUnique({
    where: { podId },
    select: {
      podPayoutsEnabled: true,
      podRevenueShareBps: true,
      podPayoutRecipientUserId: true,
      minimumPayoutCents: true,
    },
  });
}

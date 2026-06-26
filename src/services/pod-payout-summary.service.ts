/**
 * Pod-owner payout visibility summary (designated payout account owner only).
 */
import "server-only";

import { canViewPodPayouts } from "@/lib/permissions";
import { derivePodPayoutConnectStatus } from "@/lib/pod-payout-connect-status";
import {
  aggregateEligibleSalesCents,
  aggregatePodOwnerPayoutTotals,
  aggregatePodRevenueShareCents,
  buildOwnerPayoutHistory,
  ownerTransferStatusLabel,
  pickLastSentTransfer,
} from "@/lib/pod-payout-owner-summary";
import {
  formatMinimumPayoutDollarsForInput,
  podRevenueShareBpsToPercentLabel,
} from "@/lib/pod-payout-settings";
import { prisma } from "@/lib/db";

export type PodOwnerPayoutHistoryRow = {
  id: string;
  date: Date;
  amountCents: number;
  statusLabel: string;
};

export type PodOwnerPayoutSummary = {
  enabled: boolean;
  podSharePercentLabel: string;
  payoutSetupStatus: string;
  payoutSetupReady: boolean;
  pendingAllocationAmountCents: number;
  pendingAllocationCount: number;
  blockedAmountCents: number;
  blockedCount: number;
  cancelledAmountCents: number;
  cancelledCount: number;
  sentAmountCents: number;
  sentCount: number;
  needsReviewCount: number;
  eligibleSalesCents: number;
  podRevenueShareCents: number;
  lastTransferAmountCents: number | null;
  lastTransferDate: Date | null;
  lastTransferStatus: string | null;
  minimumPayoutCents: number;
  minimumPayoutLabel: string;
  payoutHistory: PodOwnerPayoutHistoryRow[];
};

/**
 * Returns payout summary for the designated pod payout account owner only.
 * Returns null when the viewer is not authorized (managers, other owners, guests).
 */
export async function getPodOwnerPayoutSummary(
  podId: string,
  viewerUserId: string
): Promise<PodOwnerPayoutSummary | null> {
  const allowed = await canViewPodPayouts(viewerUserId, podId);
  if (!allowed) return null;

  const settings = await prisma.podPayoutSettings.findUnique({
    where: { podId },
    select: {
      podPayoutsEnabled: true,
      podRevenueShareBps: true,
      minimumPayoutCents: true,
    },
  });

  const podSharePercentLabel = podRevenueShareBpsToPercentLabel(settings?.podRevenueShareBps ?? 0);
  const minimumPayoutCents = settings?.minimumPayoutCents ?? 0;
  const minimumPayoutLabel =
    minimumPayoutCents > 0
      ? `$${formatMinimumPayoutDollarsForInput(minimumPayoutCents)}`
      : "No minimum";

  if (!settings?.podPayoutsEnabled) {
    return {
      enabled: false,
      podSharePercentLabel,
      payoutSetupStatus: "Pod payouts are not enabled for this pod yet.",
      payoutSetupReady: false,
      pendingAllocationAmountCents: 0,
      pendingAllocationCount: 0,
      blockedAmountCents: 0,
      blockedCount: 0,
      cancelledAmountCents: 0,
      cancelledCount: 0,
      sentAmountCents: 0,
      sentCount: 0,
      needsReviewCount: 0,
      eligibleSalesCents: 0,
      podRevenueShareCents: 0,
      lastTransferAmountCents: null,
      lastTransferDate: null,
      lastTransferStatus: null,
      minimumPayoutCents,
      minimumPayoutLabel,
      payoutHistory: [],
    };
  }

  const [allocations, transfers, recipientUser] = await Promise.all([
    prisma.podPayoutAllocation.findMany({
      where: { podId },
      select: { status: true, podPayoutAmountCents: true, eligibleSubtotalCents: true },
    }),
    prisma.podPayoutTransfer.findMany({
      where: { podId },
      select: {
        id: true,
        status: true,
        amountCents: true,
        blockedReason: true,
        createdAt: true,
        paidAt: true,
        submittedAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findUnique({
      where: { id: viewerUserId },
      select: {
        podPayoutStripeConnectedAccountId: true,
        podPayoutStripeChargesEnabled: true,
        podPayoutStripePayoutsEnabled: true,
        podPayoutStripeRequirementsCurrentlyDue: true,
      },
    }),
  ]);

  const connectStatus = recipientUser
    ? derivePodPayoutConnectStatus({
        podPayoutStripeConnectedAccountId: recipientUser.podPayoutStripeConnectedAccountId,
        podPayoutStripeChargesEnabled: recipientUser.podPayoutStripeChargesEnabled,
        podPayoutStripePayoutsEnabled: recipientUser.podPayoutStripePayoutsEnabled,
        podPayoutStripeRequirementsCurrentlyDue:
          recipientUser.podPayoutStripeRequirementsCurrentlyDue,
      })
    : null;

  const totals = aggregatePodOwnerPayoutTotals(allocations, transfers);
  const eligibleSalesCents = aggregateEligibleSalesCents(allocations);
  const podRevenueShareCents = aggregatePodRevenueShareCents(allocations);
  const lastSent = pickLastSentTransfer(transfers);
  const payoutHistory = buildOwnerPayoutHistory(transfers);

  return {
    enabled: true,
    podSharePercentLabel,
    payoutSetupStatus: connectStatus?.ownerLabel ?? "Payout account setup needed",
    payoutSetupReady: connectStatus?.ready ?? false,
    ...totals,
    eligibleSalesCents,
    podRevenueShareCents,
    lastTransferAmountCents: lastSent?.amountCents ?? null,
    lastTransferDate: lastSent
      ? (lastSent.paidAt ?? lastSent.submittedAt ?? lastSent.createdAt)
      : null,
    lastTransferStatus: lastSent ? ownerTransferStatusLabel(lastSent.status) : null,
    minimumPayoutCents,
    minimumPayoutLabel,
    payoutHistory,
  };
}

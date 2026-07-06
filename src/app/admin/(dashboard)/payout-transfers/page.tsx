import { prisma } from "@/lib/db";
import { fetchStripePlatformBalance } from "@/services/stripe-balance.service";
import { platformPayoutDisplayForListRow } from "@/services/stripe-platform-payout-lookup.service";
import { buildPayoutTransferMoneyContext } from "@/lib/stripe-money-movement";
import { getStripeRecommendedPlatformMinimumBalanceCents } from "@/lib/stripe-platform-payout-config.server";
import type {
  AdminPayoutTransferRow,
  AdminTransferReversalRow,
  AdminVendorOption,
} from "./payout-transfers-admin.types";
import { clawbackBadgesForPayoutTransfers } from "@/services/admin-payout-transfer-list.service";
import { listPodPayoutTransfersForAdminDashboard } from "@/services/admin-pod-payout-transfer-list.service";
import { PayoutTransfersDashboard } from "./PayoutTransfersDashboard";
import type { PayoutCategoryTab } from "./payout-transfers-admin.types";

const TRANSFER_TAKE = 400;
const REVERSAL_TAKE = 400;

function parseInitialCategoryTab(tab: string | undefined): PayoutCategoryTab {
  if (tab === "blocked" || tab === "pods" || tab === "vendors" || tab === "all") {
    return tab;
  }
  return "all";
}

export default async function AdminPayoutTransfersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const initialCategoryTab = parseInitialCategoryTab(sp.tab);
  const [vendors, transfers, reversals, balanceResult, podPayoutData] = await Promise.all([
    prisma.vendor.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.vendorPayoutTransfer.findMany({
      orderBy: { createdAt: "desc" },
      take: TRANSFER_TAKE,
      select: {
        id: true,
        paymentAllocationId: true,
        vendorOrderId: true,
        vendorId: true,
        destinationAccountId: true,
        amountCents: true,
        currency: true,
        status: true,
        blockedReason: true,
        stripeTransferId: true,
        idempotencyKey: true,
        batchKey: true,
        failureMessage: true,
        createdAt: true,
        submittedAt: true,
        failedAt: true,
        legacyClawbackReviewStatus: true,
        legacyClawbackReviewNote: true,
        legacyClawbackReviewedAt: true,
        legacyClawbackReviewedBy: true,
        vendor: { select: { id: true, name: true } },
        vendorOrder: { select: { id: true, orderId: true, totalCents: true } },
        paymentAllocation: {
          select: {
            netVendorTransferCents: true,
            serviceFeeCents: true,
            payment: {
              select: {
                amountCents: true,
                stripeProcessingFeeCents: true,
                stripeBalanceTransactionId: true,
                stripeChargeId: true,
              },
            },
          },
        },
      },
    }),
    prisma.vendorPayoutTransferReversal.findMany({
      orderBy: { createdAt: "desc" },
      take: REVERSAL_TAKE,
      select: {
        id: true,
        vendorPayoutTransferId: true,
        vendorOrderId: true,
        orderId: true,
        refundAttemptId: true,
        amountCents: true,
        currency: true,
        status: true,
        stripeTransferReversalId: true,
        failureMessage: true,
        batchKey: true,
        createdAt: true,
        submittedAt: true,
        failedAt: true,
        vendorId: true,
        vendor: { select: { id: true, name: true } },
        vendorOrder: { select: { id: true, orderId: true } },
        order: { select: { id: true } },
      },
    }),
    fetchStripePlatformBalance("usd"),
    listPodPayoutTransfersForAdminDashboard(TRANSFER_TAKE),
  ]);

  const clawbackBadgeByTransferId = await clawbackBadgesForPayoutTransfers(transfers, reversals);

  const initialTransfers: AdminPayoutTransferRow[] = transfers.map((t) => {
    const pa = t.paymentAllocation;
    const payment = pa.payment;
    const balanceTxnId = payment.stripeBalanceTransactionId;
    const ctx = buildPayoutTransferMoneyContext({
      paymentAmountCents: payment.amountCents,
      stripeProcessingFeeCents: payment.stripeProcessingFeeCents,
      allocationServiceFeeCents: pa.serviceFeeCents,
      netVendorTransferCents: pa.netVendorTransferCents,
      transferStatus: t.status,
      stripeTransferId: t.stripeTransferId,
      stripeBalanceTransactionId: balanceTxnId,
    });

    return {
      id: t.id,
      paymentAllocationId: t.paymentAllocationId,
      vendorOrderId: t.vendorOrderId,
      vendorId: t.vendorId,
      destinationAccountId: t.destinationAccountId,
      amountCents: t.amountCents,
      currency: t.currency,
      status: t.status,
      blockedReason: t.blockedReason,
      stripeTransferId: t.stripeTransferId,
      idempotencyKey: t.idempotencyKey,
      batchKey: t.batchKey,
      failureMessage: t.failureMessage,
      stripeChargeId: payment.stripeChargeId,
      createdAt: t.createdAt.toISOString(),
      submittedAt: t.submittedAt?.toISOString() ?? null,
      failedAt: t.failedAt?.toISOString() ?? null,
      vendor: t.vendor,
      vendorOrder: { id: t.vendorOrder.id, orderId: t.vendorOrder.orderId },
      clawbackBadge: clawbackBadgeByTransferId.get(t.id) ?? null,
      legacyClawbackReviewStatus: t.legacyClawbackReviewStatus,
      legacyClawbackReviewNote: t.legacyClawbackReviewNote,
      legacyClawbackReviewedAt: t.legacyClawbackReviewedAt?.toISOString() ?? null,
      legacyClawbackReviewedBy: t.legacyClawbackReviewedBy,
      financialReviewKind:
        clawbackBadgeByTransferId.get(t.id) === "legacy_review"
          ? "legacy"
          : clawbackBadgeByTransferId.get(t.id) === "manual_review"
            ? "manual"
            : null,
      moneyMovement: {
        customerPaymentCents: ctx.customerPaymentCents,
        stripeProcessingFeeCents: ctx.stripeProcessingFeeCents,
        stripeNetToPlatformCents: ctx.stripeNetToPlatformCents,
        vendorConnectTransferOwedCents: ctx.vendorConnectTransferOwedCents,
        vendorStillOwedCents: ctx.vendorStillOwedCents,
        openOrderRetainedCents: ctx.openOrderRetainedCents,
        stripeBalanceTransactionId: balanceTxnId,
        platformPayout: platformPayoutDisplayForListRow(balanceTxnId),
      },
    };
  });

  const initialReversals: AdminTransferReversalRow[] = reversals.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    submittedAt: r.submittedAt?.toISOString() ?? null,
    failedAt: r.failedAt?.toISOString() ?? null,
  }));

  const vendorOptions: AdminVendorOption[] = vendors.map((v) => ({ id: v.id, name: v.name }));
  const recommendedMinimumBalanceCents = getStripeRecommendedPlatformMinimumBalanceCents();

  return (
    <PayoutTransfersDashboard
      initialTransfers={initialTransfers}
      initialReversals={initialReversals}
      initialPodTransfers={podPayoutData.transfers}
      podOptions={podPayoutData.pods}
      podSummary={podPayoutData.summary}
      podReadiness={podPayoutData.readiness}
      vendors={vendorOptions}
      initialBalance={balanceResult.ok ? balanceResult.balance : null}
      initialBalanceError={balanceResult.ok ? null : balanceResult.error}
      recommendedMinimumBalanceCents={recommendedMinimumBalanceCents}
      initialCategoryTab={initialCategoryTab}
    />
  );
}

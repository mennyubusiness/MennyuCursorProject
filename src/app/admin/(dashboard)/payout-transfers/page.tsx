import { prisma } from "@/lib/db";
import { fetchStripePlatformBalance } from "@/services/stripe-balance.service";
import { platformPayoutDisplayForListRow } from "@/services/stripe-platform-payout-lookup.service";
import { buildPayoutTransferMoneyContext, ADMIN_VENDOR_TRANSFERS_PAGE_INTRO } from "@/lib/stripe-money-movement";
import type {
  AdminPayoutTransferRow,
  AdminTransferReversalRow,
  AdminVendorOption,
} from "./payout-transfers-admin.types";
import { clawbackBadgesForPayoutTransfers } from "@/services/admin-payout-transfer-list.service";
import { PayoutTransfersDashboard } from "./PayoutTransfersDashboard";

const TRANSFER_TAKE = 400;
const REVERSAL_TAKE = 400;

export default async function AdminPayoutTransfersPage() {
  const [vendors, transfers, reversals, balanceResult] = await Promise.all([
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
      createdAt: t.createdAt.toISOString(),
      submittedAt: t.submittedAt?.toISOString() ?? null,
      failedAt: t.failedAt?.toISOString() ?? null,
      vendor: t.vendor,
      vendorOrder: { id: t.vendorOrder.id, orderId: t.vendorOrder.orderId },
      clawbackBadge: clawbackBadgeByTransferId.get(t.id) ?? null,
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-oo-charcoal">Vendor Transfers</h1>
        <p className="mt-1 max-w-3xl text-sm text-oo-stone-gray">{ADMIN_VENDOR_TRANSFERS_PAGE_INTRO}</p>
      </div>

      <PayoutTransfersDashboard
        initialTransfers={initialTransfers}
        initialReversals={initialReversals}
        vendors={vendorOptions}
        initialBalance={balanceResult.ok ? balanceResult.balance : null}
        initialBalanceError={balanceResult.ok ? null : balanceResult.error}
      />
    </div>
  );
}

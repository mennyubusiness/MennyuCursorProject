import "server-only";

import { computeVendorOrderRefundedCents } from "@/domain/order-refund";
import { assessRefundEvidenceForReversalPrep } from "@/lib/admin-refund-evidence";
import {
  transferClawbackBadgeFromSummary,
  type TransferClawbackBadgeKind,
} from "@/lib/admin-payout-transfer-clawback-badge";
import { prisma } from "@/lib/db";
import { computeVendorClawbackSummary } from "@/lib/vendor-clawback-status";

type ReversalRow = {
  vendorPayoutTransferId: string;
  status: string;
  amountCents: number;
  stripeTransferReversalId: string | null;
  failureMessage: string | null;
  createdAt: Date;
  submittedAt: Date | null;
};

type TransferRow = {
  id: string;
  status: string;
  stripeTransferId: string | null;
  amountCents: number;
  legacyClawbackReviewStatus: string | null;
  vendorOrderId: string;
  vendorOrder: { orderId: string; totalCents: number };
};

export async function clawbackBadgesForPayoutTransfers(
  transfers: TransferRow[],
  reversals: ReversalRow[]
): Promise<Map<string, TransferClawbackBadgeKind | null>> {
  const paid = transfers.filter((t) => t.status === "paid" && Boolean(t.stripeTransferId?.trim()));
  if (paid.length === 0) return new Map();

  const reversalsByVpt = new Map<string, ReversalRow[]>();
  for (const r of reversals) {
    const list = reversalsByVpt.get(r.vendorPayoutTransferId) ?? [];
    list.push(r);
    reversalsByVpt.set(r.vendorPayoutTransferId, list);
  }

  const orderIds = [...new Set(paid.map((t) => t.vendorOrder.orderId))];
  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    select: {
      id: true,
      totalCents: true,
      totalRefundedCents: true,
      orderRefunds: {
        select: {
          id: true,
          vendorOrderId: true,
          amountCents: true,
          status: true,
          refundScope: true,
          refundAttemptId: true,
          stripeRefundId: true,
          refundAttempt: { select: { status: true } },
        },
      },
      refundAttempts: {
        select: {
          id: true,
          vendorOrderId: true,
          amountCents: true,
          status: true,
          stripeRefundId: true,
          dismissedAsLegacyAt: true,
        },
      },
    },
  });
  const orderById = new Map(orders.map((o) => [o.id, o]));

  const badges = new Map<string, TransferClawbackBadgeKind | null>();
  for (const t of paid) {
    const order = orderById.get(t.vendorOrder.orderId);
    if (!order) {
      badges.set(t.id, null);
      continue;
    }

    const voReversals = (reversalsByVpt.get(t.id) ?? []).map((r) => ({
      id: undefined,
      status: r.status,
      amountCents: r.amountCents,
      failureMessage: r.failureMessage,
      createdAt: r.createdAt,
      submittedAt: r.submittedAt,
      stripeTransferReversalId: r.stripeTransferReversalId,
    }));

    const linkedAttemptIds = new Set(
      order.orderRefunds.map((r) => r.refundAttemptId).filter((id): id is string => Boolean(id))
    );
    const legacyAttempts = order.refundAttempts.map((a) => ({
      id: a.id,
      vendorOrderId: a.vendorOrderId,
      amountCents: a.amountCents,
      status: a.status,
      stripeRefundId: a.stripeRefundId,
      dismissedAsLegacyAt: a.dismissedAsLegacyAt,
      hasLinkedOrderRefund: linkedAttemptIds.has(a.id),
    }));
    const orderRefundsForAllocation = order.orderRefunds.map((r) => ({
      vendorOrderId: r.vendorOrderId,
      amountCents: r.amountCents,
      status: r.status,
      refundScope: r.refundScope,
    }));
    const ledgerRefundedCents = order.orderRefunds
      .filter((r) => r.status === "succeeded")
      .reduce((s, r) => s + r.amountCents, 0);
    const legacyRefundedCents = legacyAttempts
      .filter((a) => a.status === "succeeded" && !a.hasLinkedOrderRefund && !a.dismissedAsLegacyAt)
      .reduce((s, a) => s + a.amountCents, 0);

    const refundEvidence = assessRefundEvidenceForReversalPrep({
      orderId: order.id,
      orderTotalCents: order.totalCents,
      denormalizedOrderRefundedCents: order.totalRefundedCents,
      ledgerRefundedCents,
      legacyRefundedCents,
      vendorOrderId: t.vendorOrderId,
      vendorOrderTotalCents: t.vendorOrder.totalCents,
      orderRefunds: order.orderRefunds.map((r) => ({
        id: r.id,
        vendorOrderId: r.vendorOrderId,
        amountCents: r.amountCents,
        status: r.status,
        refundScope: r.refundScope,
        refundAttemptId: r.refundAttemptId,
        refundAttemptStatus: r.refundAttempt?.status ?? null,
        stripeRefundId: r.stripeRefundId,
      })),
      legacyAttempts,
    });

    const effectiveRefunded = computeVendorOrderRefundedCents({
      vendorOrderId: t.vendorOrderId,
      vendorOrderTotalCents: t.vendorOrder.totalCents,
      orderRefunds: orderRefundsForAllocation,
      legacyAttempts,
    });
    const vendorRefundedForClawback =
      refundEvidence.inconsistentLedger || refundEvidence.denormalizedOnlyRefund
        ? Math.max(order.totalRefundedCents, effectiveRefunded)
        : effectiveRefunded;

    const clawback = computeVendorClawbackSummary({
      transferStatus: t.status,
      stripeTransferId: t.stripeTransferId,
      transferAmountCents: t.amountCents,
      vendorOrderTotalCents: t.vendorOrder.totalCents,
      vendorOrderRefundedCents: vendorRefundedForClawback,
      reversals: voReversals,
    });

    const unsafeLegacyRefundLinkage =
      refundEvidence.inconsistentLedger ||
      refundEvidence.denormalizedOnlyRefund ||
      (!refundEvidence.hasSafeFullScopeSucceededRefund &&
        vendorRefundedForClawback > 0 &&
        voReversals.length === 0);

    badges.set(
      t.id,
      transferClawbackBadgeFromSummary({
        clawback,
        legacyClawbackReviewStatus: t.legacyClawbackReviewStatus,
        unsafeLegacyRefundLinkage,
      })
    );
  }

  return badges;
}

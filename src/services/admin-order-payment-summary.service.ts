/**
 * Admin order detail: payment, allocations, transfers, refunds (read-only aggregate).
 */
import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  getOrderRefundSummary,
  getRemainingOrderRefundableCents,
  getRemainingVendorOrderRefundableCents,
} from "@/services/refund-ledger.service";
import { VENDOR_PAYOUT_TRANSFER_STATUS } from "@/services/vendor-payout-transfer.service";
import { getVendorTransferReversalAmountCents } from "@/services/vendor-payout-transfer-reversal.service";
import {
  CANCELLED_DUE_TO_REFUND_DISPLAY,
  CANCELLED_DUE_TO_REFUND_STATUS,
  PARTIAL_REFUND_MANUAL_REVIEW_DISPLAY,
  PARTIAL_REFUND_MANUAL_REVIEW_STATUS,
} from "@/lib/vendor-payout-transfer-refund-eligibility";
import {
  computeVendorClawbackSummary,
  type VendorClawbackSummary,
} from "@/lib/vendor-clawback-status";
import { computeVendorOrderRefundedCents } from "@/domain/order-refund";
import {
  assessRefundEvidenceForReversalPrep,
  prepareMissingReversalBlockMessage,
  type PrepareMissingReversalBlockReason,
} from "@/lib/admin-refund-evidence";
import {
  isLegacyClawbackReviewClosed,
  legacyClawbackReviewStatusLabel,
} from "@/lib/legacy-clawback-review";
import {
  openOrderRetainedFromPayment,
  openOrderRetainedFromVendorSlice,
  stripeNetToPlatformCents,
  vendorStillOwedCents,
  type PlatformPayoutDisplayStatus,
} from "@/lib/stripe-money-movement";
import { lookupPlatformPayoutForBalanceTransaction } from "@/services/stripe-platform-payout-lookup.service";

export class AdminPaymentSummarySchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminPaymentSummarySchemaError";
  }
}

function isSchemaMigrationError(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    return e.code === "P2022";
  }
  const msg = e instanceof Error ? e.message : String(e);
  return (
    msg.includes("totalRefundedCents") ||
    msg.includes("paymentRefundStatus") ||
    msg.includes("OrderRefund") ||
    msg.includes("stripeChargeId")
  );
}

export type VendorTransferUiMessage = {
  status: string;
  message: string;
  tone: "neutral" | "warning" | "danger" | "success";
};

export function vendorTransferUiMessage(input: {
  transferStatus: string | null;
  stripeTransferId: string | null;
  reversals?: Array<{ status: string }>;
}): VendorTransferUiMessage {
  const reversals = input.reversals ?? [];
  const hasPending = reversals.some((r) => r.status === "pending");
  const hasSubmitted = reversals.some((r) => r.status === "submitted");
  const hasReversed = reversals.some((r) => r.status === "reversed");
  const hasFailed = reversals.some((r) => r.status === "failed");

  if (hasReversed && !hasPending && !hasSubmitted) {
    return {
      status: input.transferStatus ?? "paid",
      message: "Vendor transfer reversal completed in Stripe.",
      tone: "success",
    };
  }
  if (hasFailed) {
    return {
      status: input.transferStatus ?? "paid",
      message:
        "Transfer reversal failed. Retry from the vendor transfer reversals workflow (/admin/payout-transfers).",
      tone: "danger",
    };
  }
  if (hasSubmitted) {
    return {
      status: input.transferStatus ?? "paid",
      message:
        "Transfer reversal submitted to Stripe — confirm status in vendor transfer reversals workflow.",
      tone: "warning",
    };
  }
  if (hasPending) {
    return {
      status: input.transferStatus ?? "paid",
      message:
        "Transfer reversal prepared (pending). Execute manually in vendor transfer reversals workflow (/admin/payout-transfers). Customer refund alone does not claw back vendor funds.",
      tone: "warning",
    };
  }

  const status = input.transferStatus ?? "missing";
  if (status === CANCELLED_DUE_TO_REFUND_STATUS) {
    return {
      status,
      message: CANCELLED_DUE_TO_REFUND_DISPLAY,
      tone: "neutral",
    };
  }
  if (status === PARTIAL_REFUND_MANUAL_REVIEW_STATUS) {
    return {
      status,
      message: PARTIAL_REFUND_MANUAL_REVIEW_DISPLAY,
      tone: "warning",
    };
  }
  if (status === "paid") {
    if (!input.stripeTransferId?.trim()) {
      return {
        status,
        message:
          "Transfer marked paid but Stripe transfer ID is missing. Review before refund.",
        tone: "danger",
      };
    }
    return {
      status,
      message: "Refund may require transfer reversal.",
      tone: "warning",
    };
  }
  if (status === "submitted") {
    return {
      status,
      message: "Transfer submitted. Reversal may not be available until paid.",
      tone: "warning",
    };
  }
  if (
    status === "pending" ||
    status === "blocked" ||
    status === "failed" ||
    status === "missing"
  ) {
    return {
      status,
      message: "No Stripe transfer reversal needed yet.",
      tone: "neutral",
    };
  }
  return { status, message: "No Stripe transfer reversal needed yet.", tone: "neutral" };
}

export type AdminOrderPaymentSummaryPayment = {
  id: string;
  stripePaymentIntentId: string;
  stripeChargeId: string | null;
  stripeBalanceTransactionId: string | null;
  amountCents: number;
  stripeProcessingFeeCents: number | null;
  status: string;
  createdAt: string;
};

export type AdminOrderPaymentSummaryLineItem = {
  id: string;
  name: string;
  quantity: number;
  priceCents: number;
  /** Internal group-order attribution (admin display only). */
  groupOrderParticipantId: string | null;
};

export type AdminOrderPaymentSummaryVendorOrder = {
  id: string;
  vendorId: string;
  vendorName: string;
  lineItems: AdminOrderPaymentSummaryLineItem[];
  routingStatus: string;
  fulfillmentStatus: string;
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  serviceFeeCents: number;
  totalCents: number;
  totalRefundedCents: number;
  remainingRefundableCents: number;
  grossVendorPayableCents: number | null;
  allocatedProcessingFeeCents: number | null;
  netVendorTransferCents: number | null;
  paymentAllocationId: string | null;
  vendorPayoutTransferId: string | null;
  transferStatus: string | null;
  stripeTransferId: string | null;
  transferAmountCents: number | null;
  vendorStillOwedCents: number;
  openOrderRetainedCents: number | null;
  transferMessage: VendorTransferUiMessage;
  clawback: VendorClawbackSummary;
  fullRefundMayRequireReversal: boolean;
  partialRefundWouldRequirePlatformAbsorption: boolean;
  reversals: Array<{
    id: string;
    status: string;
    amountCents: number;
    stripeTransferReversalId: string | null;
    refundAttemptId: string;
    failureMessage: string | null;
    createdAt: string;
    submittedAt: string | null;
  }>;
  reversalPrepare: {
    canPrepare: boolean;
    blockReason: PrepareMissingReversalBlockReason | null;
  };
  legacyClawbackReview: {
    status: string | null;
    note: string | null;
    reviewedAt: string | null;
    reviewedBy: string | null;
    needsReview: boolean;
    kind: "manual" | "legacy" | null;
  } | null;
};

export type AdminOrderRefundLedgerRow = {
  id: string;
  source: "order_refund" | "legacy_refund_attempt";
  createdAt: string | null;
  refundScope: string | null;
  vendorName: string | null;
  amountCents: number;
  status: string;
  stripeRefundId: string | null;
  refundAttemptId: string | null;
  refundAttemptStatus: string | null;
};

export type AdminOrderRefundDisplay = {
  refundedCents: number;
  denormalizedRefundedCents: number;
  inconsistentLedger: boolean;
  ledgerRowCount: number;
};

export type AdminOrderPaymentSummaryRefund = {
  id: string;
  createdAt: string;
  completedAt: string | null;
  refundScope: string;
  vendorOrderId: string | null;
  vendorName: string | null;
  amountCents: number;
  status: string;
  reason: string;
  initiatedByRole: string;
  stripeRefundId: string | null;
  adminNote: string | null;
  customerVisibleNote: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  refundAttemptId: string | null;
  refundAttemptStatus: string | null;
};

export type AdminOrderPaymentSummary = {
  order: {
    id: string;
    status: string;
    paymentRefundStatus: string | null;
    subtotalCents: number;
    serviceFeeCents: number;
    taxCents: number;
    tipCents: number;
    totalCents: number;
    totalRefundedCents: number;
    remainingRefundableCents: number;
    stripePaymentIntentId: string | null;
  };
  payment: AdminOrderPaymentSummaryPayment | null;
  vendorOrders: AdminOrderPaymentSummaryVendorOrder[];
  orderRefunds: AdminOrderPaymentSummaryRefund[];
  refundLedgerRows: AdminOrderRefundLedgerRow[];
  refundDisplay: AdminOrderRefundDisplay;
  ledgerSummary: {
    paymentAmountCents: number;
    totalRefundedCents: number;
    ledgerRefundedCents: number;
    legacyRefundedCents: number;
    remainingRefundableCents: number;
    paymentRefundStatus: string;
    hasPendingRefund: boolean;
    staleBlockingRefundAttempts: Array<{
      id: string;
      amountCents: number;
      status: string;
      stripeRefundId: string | null;
      failureCode: string | null;
      failureMessage: string | null;
      createdAt: string;
      dismissible: boolean;
      dismissBlockReason: string | null;
    }>;
    inFlightRefundBlockers: Array<{
      source: "order_refund" | "refund_attempt";
      id: string;
      amountCents: number;
      status: string;
      stripeRefundId: string | null;
      createdAt: string | null;
    }>;
  } | null;
  moneyMovement: {
    customerPaymentCents: number;
    stripeProcessingFeeCents: number | null;
    stripeNetToPlatformCents: number | null;
    openOrderRetainedCents: number | null;
    platformPayout: PlatformPayoutDisplayStatus;
  } | null;
};

export async function fetchAdminOrderPaymentSummary(
  orderId: string
): Promise<AdminOrderPaymentSummary | null> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        paymentRefundStatus: true,
        subtotalCents: true,
        serviceFeeCents: true,
        taxCents: true,
        tipCents: true,
        totalCents: true,
        totalRefundedCents: true,
        stripePaymentIntentId: true,
        payments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            stripePaymentIntentId: true,
            stripeChargeId: true,
            stripeBalanceTransactionId: true,
            amountCents: true,
            stripeProcessingFeeCents: true,
            status: true,
            createdAt: true,
            allocations: {
              select: {
                id: true,
                vendorOrderId: true,
                grossVendorPayableCents: true,
                allocatedProcessingFeeCents: true,
                netVendorTransferCents: true,
                payoutTransfer: {
                  select: {
                    id: true,
                    status: true,
                    stripeTransferId: true,
                    amountCents: true,
                    legacyClawbackReviewStatus: true,
                    legacyClawbackReviewNote: true,
                    legacyClawbackReviewedAt: true,
                    legacyClawbackReviewedBy: true,
                  },
                },
              },
            },
          },
        },
        vendorOrders: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            vendorId: true,
            routingStatus: true,
            fulfillmentStatus: true,
            subtotalCents: true,
            taxCents: true,
            tipCents: true,
            serviceFeeCents: true,
            totalCents: true,
            totalRefundedCents: true,
            vendor: { select: { name: true } },
            lineItems: {
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                name: true,
                quantity: true,
                priceCents: true,
                groupOrderParticipantId: true,
              },
            },
          },
        },
        orderRefunds: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            createdAt: true,
            completedAt: true,
            refundScope: true,
            vendorOrderId: true,
            amountCents: true,
            status: true,
            reason: true,
            initiatedByRole: true,
            stripeRefundId: true,
            adminNote: true,
            customerVisibleNote: true,
            failureCode: true,
            failureMessage: true,
            refundAttemptId: true,
            refundAttempt: { select: { status: true } },
            vendorOrder: { select: { vendor: { select: { name: true } } } },
          },
        },
        refundAttempts: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            vendorOrderId: true,
            amountCents: true,
            status: true,
            stripeRefundId: true,
            reason: true,
            createdAt: true,
            dismissedAsLegacyAt: true,
          },
        },
        vendorPayoutTransferReversals: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            vendorOrderId: true,
            status: true,
            amountCents: true,
            stripeTransferReversalId: true,
            refundAttemptId: true,
            failureMessage: true,
            createdAt: true,
            submittedAt: true,
          },
        },
      },
    });

    if (!order) return null;

    const payment = order.payments[0] ?? null;
    const allocByVo = new Map(
      payment?.allocations.map((a) => [a.vendorOrderId, a]) ?? []
    );
    const reversalsByVo = new Map<string, AdminOrderPaymentSummaryVendorOrder["reversals"]>();
    for (const r of order.vendorPayoutTransferReversals) {
      const list = reversalsByVo.get(r.vendorOrderId) ?? [];
      list.push({
        id: r.id,
        status: r.status,
        amountCents: r.amountCents,
        stripeTransferReversalId: r.stripeTransferReversalId,
        refundAttemptId: r.refundAttemptId,
        failureMessage: r.failureMessage,
        createdAt: r.createdAt.toISOString(),
        submittedAt: r.submittedAt?.toISOString() ?? null,
      });
      reversalsByVo.set(r.vendorOrderId, list);
    }

    const linkedAttemptIds = new Set(
      order.orderRefunds
        .map((r) => r.refundAttemptId)
        .filter((id): id is string => Boolean(id))
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
    const orderRefundsForEvidence = order.orderRefunds.map((r) => ({
      id: r.id,
      vendorOrderId: r.vendorOrderId,
      amountCents: r.amountCents,
      status: r.status,
      refundScope: r.refundScope,
      refundAttemptId: r.refundAttemptId,
      refundAttemptStatus: r.refundAttempt?.status ?? null,
      stripeRefundId: r.stripeRefundId,
    }));

    const [remainingOrder, ledgerSummary] = await Promise.all([
      getRemainingOrderRefundableCents(orderId),
      getOrderRefundSummary(orderId),
    ]);

    const vendorOrders: AdminOrderPaymentSummaryVendorOrder[] = await Promise.all(
      order.vendorOrders.map(async (vo) => {
        const alloc = allocByVo.get(vo.id);
        const vpt = alloc?.payoutTransfer ?? null;
        const transferStatus = vpt?.status ?? null;
        const remainingVo = await getRemainingVendorOrderRefundableCents(vo.id);
        const voReversals = reversalsByVo.get(vo.id) ?? [];
        const transferMessage = vendorTransferUiMessage({
          transferStatus,
          stripeTransferId: vpt?.stripeTransferId ?? null,
          reversals: voReversals,
        });
        const paidOrSubmitted =
          transferStatus === VENDOR_PAYOUT_TRANSFER_STATUS.paid ||
          transferStatus === VENDOR_PAYOUT_TRANSFER_STATUS.submitted;
        const reversalPossible =
          Boolean(vpt?.stripeTransferId?.trim()) &&
          vpt != null &&
          getVendorTransferReversalAmountCents(vpt) > 0;
        const netTransfer = alloc?.netVendorTransferCents ?? vpt?.amountCents ?? 0;
        const effectiveVendorOrderRefundedCents = computeVendorOrderRefundedCents({
          vendorOrderId: vo.id,
          vendorOrderTotalCents: vo.totalCents,
          orderRefunds: orderRefundsForAllocation,
          legacyAttempts,
        });
        const refundEvidence = assessRefundEvidenceForReversalPrep({
          orderId,
          orderTotalCents: order.totalCents,
          denormalizedOrderRefundedCents: order.totalRefundedCents,
          ledgerRefundedCents: ledgerSummary?.ledgerRefundedCents ?? 0,
          legacyRefundedCents: ledgerSummary?.legacyRefundedCents ?? 0,
          vendorOrderId: vo.id,
          vendorOrderTotalCents: vo.totalCents,
          orderRefunds: orderRefundsForEvidence,
          legacyAttempts,
        });

        const vendorRefundedForClawback =
          refundEvidence.inconsistentLedger || refundEvidence.denormalizedOnlyRefund
            ? 0
            : effectiveVendorOrderRefundedCents;

        let clawback = computeVendorClawbackSummary({
          transferStatus,
          stripeTransferId: vpt?.stripeTransferId ?? null,
          transferAmountCents: vpt?.amountCents ?? null,
          vendorOrderTotalCents: vo.totalCents,
          vendorOrderRefundedCents: vendorRefundedForClawback,
          reversals: voReversals,
        });

        const paidViaConnect =
          transferStatus === VENDOR_PAYOUT_TRANSFER_STATUS.paid &&
          Boolean(vpt?.stripeTransferId?.trim());

        let reversalPrepare: AdminOrderPaymentSummaryVendorOrder["reversalPrepare"] = {
          canPrepare: false,
          blockReason: refundEvidence.prepareBlockReason,
        };

        if (clawback.hasMissingReversalSetup && refundEvidence.hasSafeFullScopeSucceededRefund) {
          reversalPrepare = { canPrepare: true, blockReason: null };
        } else if (
          clawback.hasMissingReversalSetup &&
          !refundEvidence.hasSafeFullScopeSucceededRefund
        ) {
          clawback = {
            ...clawback,
            clawbackStatus: "manual_review",
            adminLabel: "Vendor clawback manual review",
            adminDetail:
              refundEvidence.inconsistentLedger || refundEvidence.denormalizedOnlyRefund
                ? "Refund total exists, but no refund ledger entry was found. This may be legacy or inconsistent data."
                : prepareMissingReversalBlockMessage(
                    refundEvidence.prepareBlockReason ?? "no_succeeded_order_refund"
                  ),
            hasMissingReversalSetup: false,
            recommendedAction: "manual_review",
          };
          reversalPrepare = {
            canPrepare: false,
            blockReason: refundEvidence.prepareBlockReason,
          };
        } else if (
          paidViaConnect &&
          (refundEvidence.inconsistentLedger || refundEvidence.denormalizedOnlyRefund) &&
          voReversals.length === 0 &&
          clawback.clawbackStatus === "not_needed"
        ) {
          clawback = {
            ...clawback,
            clawbackStatus: "manual_review",
            adminLabel: "Vendor clawback manual review",
            adminDetail:
              "Refund total exists, but no refund ledger entry was found. This may be legacy or inconsistent data.",
            recommendedAction: "manual_review",
          };
        }

        const needsLegacyClawbackReview =
          Boolean(vpt?.stripeTransferId?.trim()) &&
          transferStatus === VENDOR_PAYOUT_TRANSFER_STATUS.paid &&
          !reversalPrepare.canPrepare &&
          (refundEvidence.inconsistentLedger || refundEvidence.denormalizedOnlyRefund) &&
          voReversals.length === 0 &&
          !isLegacyClawbackReviewClosed(vpt?.legacyClawbackReviewStatus);

        const needsManualFinancialReview =
          Boolean(vpt?.stripeTransferId?.trim()) &&
          transferStatus === VENDOR_PAYOUT_TRANSFER_STATUS.paid &&
          clawback.clawbackStatus === "manual_review" &&
          !reversalPrepare.canPrepare &&
          !needsLegacyClawbackReview &&
          !isLegacyClawbackReviewClosed(vpt?.legacyClawbackReviewStatus);

        const needsFinancialReview = needsLegacyClawbackReview || needsManualFinancialReview;
        const financialReviewKind = needsLegacyClawbackReview
          ? ("legacy" as const)
          : needsManualFinancialReview
            ? ("manual" as const)
            : null;

        if (vpt && isLegacyClawbackReviewClosed(vpt.legacyClawbackReviewStatus)) {
          clawback = {
            ...clawback,
            clawbackStatus: "manual_review",
            adminLabel: `Legacy clawback ${legacyClawbackReviewStatusLabel(vpt.legacyClawbackReviewStatus).toLowerCase()}`,
            adminDetail:
              vpt.legacyClawbackReviewNote?.trim() ||
              "Marked after manual Stripe review. No automatic transfer reversal was created.",
            hasMissingReversalSetup: false,
            recommendedAction: "manual_review",
          };
        } else if (needsLegacyClawbackReview) {
          clawback = {
            ...clawback,
            clawbackStatus: "manual_review",
            adminLabel: "Legacy clawback review required",
            adminDetail:
              "Refund evidence is incomplete, so Open Order cannot safely prepare an automatic vendor reversal.",
            recommendedAction: "manual_review",
          };
        }

        return {
          id: vo.id,
          vendorId: vo.vendorId,
          vendorName: vo.vendor.name,
          lineItems: vo.lineItems.map((li) => ({
            id: li.id,
            name: li.name,
            quantity: li.quantity,
            priceCents: li.priceCents,
            groupOrderParticipantId: li.groupOrderParticipantId ?? null,
          })),
          routingStatus: vo.routingStatus,
          fulfillmentStatus: vo.fulfillmentStatus,
          subtotalCents: vo.subtotalCents,
          taxCents: vo.taxCents,
          tipCents: vo.tipCents,
          serviceFeeCents: vo.serviceFeeCents,
          totalCents: vo.totalCents,
          totalRefundedCents: effectiveVendorOrderRefundedCents,
          remainingRefundableCents: remainingVo,
          grossVendorPayableCents: alloc?.grossVendorPayableCents ?? null,
          allocatedProcessingFeeCents: alloc?.allocatedProcessingFeeCents ?? null,
          netVendorTransferCents: alloc?.netVendorTransferCents ?? null,
          paymentAllocationId: alloc?.id ?? null,
          vendorPayoutTransferId: vpt?.id ?? null,
          transferStatus,
          stripeTransferId: vpt?.stripeTransferId ?? null,
          transferAmountCents: vpt?.amountCents ?? null,
          vendorStillOwedCents: vendorStillOwedCents({
            transferStatus: transferStatus ?? "missing",
            stripeTransferId: vpt?.stripeTransferId ?? null,
            vendorConnectTransferOwedCents: netTransfer,
          }),
          openOrderRetainedCents: openOrderRetainedFromVendorSlice(vo.serviceFeeCents),
          transferMessage,
          clawback,
          fullRefundMayRequireReversal:
            transferStatus === VENDOR_PAYOUT_TRANSFER_STATUS.paid && reversalPossible,
          partialRefundWouldRequirePlatformAbsorption: paidOrSubmitted,
          reversals: voReversals,
          reversalPrepare,
          legacyClawbackReview: vpt
            ? {
                status: vpt.legacyClawbackReviewStatus,
                note: vpt.legacyClawbackReviewNote,
                reviewedAt: vpt.legacyClawbackReviewedAt?.toISOString() ?? null,
                reviewedBy: vpt.legacyClawbackReviewedBy,
                needsReview: needsFinancialReview,
                kind: financialReviewKind,
              }
            : null,
        };
      })
    );

    const vendorNameById = new Map(order.vendorOrders.map((v) => [v.id, v.vendor.name]));

    const refundLedgerRows: AdminOrderRefundLedgerRow[] = (ledgerSummary?.refunds ?? []).map(
      (r) => {
        if (r.source === "legacy_refund_attempt") {
          const attemptId = r.id.replace(/^legacy:/, "");
          const attempt = order.refundAttempts.find((a) => a.id === attemptId);
          return {
            id: r.id,
            source: r.source,
            createdAt: attempt?.createdAt.toISOString() ?? null,
            refundScope: "legacy",
            vendorName: attempt?.vendorOrderId
              ? (vendorNameById.get(attempt.vendorOrderId) ?? null)
              : null,
            amountCents: r.amountCents,
            status: r.status,
            stripeRefundId: r.stripeRefundId,
            refundAttemptId: attemptId,
            refundAttemptStatus: attempt?.status ?? null,
          };
        }
        const ledgerRow = order.orderRefunds.find((or) => or.id === r.id);
        return {
          id: r.id,
          source: r.source,
          createdAt: ledgerRow?.createdAt.toISOString() ?? null,
          refundScope: ledgerRow?.refundScope ?? null,
          vendorName: ledgerRow?.vendorOrderId
            ? (ledgerRow.vendorOrder?.vendor.name ??
              vendorNameById.get(ledgerRow.vendorOrderId) ??
              null)
            : null,
          amountCents: r.amountCents,
          status: r.status,
          stripeRefundId: r.stripeRefundId,
          refundAttemptId: ledgerRow?.refundAttemptId ?? null,
          refundAttemptStatus: ledgerRow?.refundAttempt?.status ?? null,
        };
      }
    );

    const refundDisplay: AdminOrderRefundDisplay = {
      refundedCents: ledgerSummary?.totalRefundedCents ?? order.totalRefundedCents,
      denormalizedRefundedCents: order.totalRefundedCents,
      inconsistentLedger:
        order.totalRefundedCents > 0 &&
        order.orderRefunds.length === 0 &&
        (ledgerSummary?.ledgerRefundedCents ?? 0) === 0 &&
        (ledgerSummary?.legacyRefundedCents ?? 0) === 0,
      ledgerRowCount: refundLedgerRows.length,
    };

    const orderRefunds: AdminOrderPaymentSummaryRefund[] = order.orderRefunds.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
      refundScope: r.refundScope,
      vendorOrderId: r.vendorOrderId,
      vendorName: r.vendorOrderId
        ? (r.vendorOrder?.vendor.name ?? vendorNameById.get(r.vendorOrderId) ?? null)
        : null,
      amountCents: r.amountCents,
      status: r.status,
      reason: r.reason,
      initiatedByRole: r.initiatedByRole,
      stripeRefundId: r.stripeRefundId,
      adminNote: r.adminNote,
      customerVisibleNote: r.customerVisibleNote,
      failureCode: r.failureCode,
      failureMessage: r.failureMessage,
      refundAttemptId: r.refundAttemptId,
      refundAttemptStatus: r.refundAttempt?.status ?? null,
    }));

    const sumNetVendorTransfer =
      payment?.allocations.reduce((sum, a) => sum + a.netVendorTransferCents, 0) ?? 0;
    const stripeNet = payment
      ? stripeNetToPlatformCents(payment.amountCents, payment.stripeProcessingFeeCents)
      : null;
    const platformPayout = payment
      ? await lookupPlatformPayoutForBalanceTransaction(payment.stripeBalanceTransactionId)
      : { kind: "unknown" as const, reason: "no_balance_transaction" as const };

    return {
      order: {
        id: order.id,
        status: order.status,
        paymentRefundStatus: order.paymentRefundStatus,
        subtotalCents: order.subtotalCents,
        serviceFeeCents: order.serviceFeeCents,
        taxCents: order.taxCents,
        tipCents: order.tipCents,
        totalCents: order.totalCents,
        totalRefundedCents: order.totalRefundedCents,
        remainingRefundableCents: remainingOrder,
        stripePaymentIntentId: order.stripePaymentIntentId,
      },
      payment: payment
        ? {
            id: payment.id,
            stripePaymentIntentId: payment.stripePaymentIntentId,
            stripeChargeId: payment.stripeChargeId,
            stripeBalanceTransactionId: payment.stripeBalanceTransactionId,
            amountCents: payment.amountCents,
            stripeProcessingFeeCents: payment.stripeProcessingFeeCents,
            status: payment.status,
            createdAt: payment.createdAt.toISOString(),
          }
        : null,
      vendorOrders,
      orderRefunds,
      refundLedgerRows,
      refundDisplay,
      ledgerSummary: ledgerSummary
        ? {
            paymentAmountCents: ledgerSummary.paymentAmountCents,
            totalRefundedCents: ledgerSummary.totalRefundedCents,
            ledgerRefundedCents: ledgerSummary.ledgerRefundedCents,
            legacyRefundedCents: ledgerSummary.legacyRefundedCents,
            remainingRefundableCents: ledgerSummary.remainingRefundableCents,
            paymentRefundStatus: ledgerSummary.paymentRefundStatus,
            hasPendingRefund: ledgerSummary.hasPendingRefund,
            staleBlockingRefundAttempts: ledgerSummary.staleBlockingRefundAttempts,
            inFlightRefundBlockers: ledgerSummary.inFlightRefundBlockers,
          }
        : null,
      moneyMovement: payment
        ? {
            customerPaymentCents: payment.amountCents,
            stripeProcessingFeeCents: payment.stripeProcessingFeeCents,
            stripeNetToPlatformCents: stripeNet,
            openOrderRetainedCents: openOrderRetainedFromPayment(stripeNet, sumNetVendorTransfer),
            platformPayout,
          }
        : null,
    };
  } catch (e) {
    if (isSchemaMigrationError(e)) {
      throw new AdminPaymentSummarySchemaError(
        "Refund ledger schema is not applied. Run: npx prisma migrate deploy (migration 20260526120000_order_refund_ledger)."
      );
    }
    throw e;
  }
}

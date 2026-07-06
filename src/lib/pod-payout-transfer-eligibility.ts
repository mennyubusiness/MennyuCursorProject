/**
 * Pod payout allocation → transfer eligibility (pure; no Stripe).
 */
import { POD_PAYOUT_ALLOCATION_STATUS } from "@/lib/pod-payout-allocation";
import {
  resolvePodPayoutTransferEnsureDecision,
  POD_PAYOUT_TRANSFER_STATUS,
  type PodPayoutConnectTransferFields,
  type PodPayoutTransferEnsureDecision,
} from "@/lib/pod-payout-transfer-decision";
import type { PaymentRefundStatusForPodTransfer } from "@/lib/pod-payout-transfer-refund-eligibility";
import {
  resolveVendorPayoutGateForPayment,
  type PaymentAllocationVendorGateRow,
} from "@/lib/pod-payout-vendor-transfer-gate";

export type PodPayoutTransferabilityReason =
  | "eligible"
  | "waiting_on_vendor_transfer"
  | "vendor_paid_unexpected_block"
  | "connect_not_ready"
  | "below_minimum"
  | "refund_review"
  | "cancelled_due_to_refund"
  | "allocation_not_pending"
  | "existing_transfer_pending"
  | "existing_transfer_blocked"
  | "no_vendor_allocations"
  | "unknown";

export const POD_PAYOUT_TRANSFERABILITY_REASON_LABELS: Record<PodPayoutTransferabilityReason, string> = {
  eligible: "Ready for pod payout batch",
  waiting_on_vendor_transfer: "Waiting on vendor transfer",
  vendor_paid_unexpected_block:
    "Vendor transfer paid but allocation still not eligible — investigate",
  connect_not_ready: "Payout account not ready",
  below_minimum: "Below minimum payout",
  refund_review: "Refund review required",
  cancelled_due_to_refund: "Cancelled due to refund",
  allocation_not_pending: "Allocation is not pending",
  existing_transfer_pending: "Transfer row ready to send",
  existing_transfer_blocked: "Transfer row blocked",
  no_vendor_allocations: "No vendor payment allocations on this payment",
  unknown: "Unknown eligibility failure",
};

export type PodPayoutAllocationTransferEligibility = {
  transferable: boolean;
  reason: PodPayoutTransferabilityReason;
  reasonLabel: string;
  ensureDecision: PodPayoutTransferEnsureDecision | null;
};

function reasonFromEnsureStatus(status: string): PodPayoutTransferabilityReason {
  switch (status) {
    case POD_PAYOUT_TRANSFER_STATUS.pending:
      return "eligible";
    case POD_PAYOUT_TRANSFER_STATUS.blockedConnectNotReady:
      return "connect_not_ready";
    case POD_PAYOUT_TRANSFER_STATUS.blockedBelowMinimum:
      return "below_minimum";
    case POD_PAYOUT_TRANSFER_STATUS.blockedPartialRefundReview:
      return "refund_review";
    case POD_PAYOUT_TRANSFER_STATUS.cancelledDueToRefund:
      return "cancelled_due_to_refund";
    default:
      return "unknown";
  }
}

export function evaluatePodPayoutAllocationTransferEligibility(input: {
  allocationStatus: string;
  podPayoutAmountCents: number;
  minimumPayoutCents: number;
  paymentRefundStatus: PaymentRefundStatusForPodTransfer;
  recipientConnect: PodPayoutConnectTransferFields | null;
  paymentAllocations: PaymentAllocationVendorGateRow[];
  existingTransferStatus?: string | null;
}): PodPayoutAllocationTransferEligibility {
  if (input.allocationStatus !== POD_PAYOUT_ALLOCATION_STATUS.pending) {
    return {
      transferable: false,
      reason: "allocation_not_pending",
      reasonLabel: POD_PAYOUT_TRANSFERABILITY_REASON_LABELS.allocation_not_pending,
      ensureDecision: null,
    };
  }

  if (
    input.existingTransferStatus &&
    input.existingTransferStatus !== POD_PAYOUT_TRANSFER_STATUS.paid &&
    input.existingTransferStatus !== POD_PAYOUT_TRANSFER_STATUS.cancelledDueToRefund &&
    input.existingTransferStatus !== POD_PAYOUT_TRANSFER_STATUS.pending
  ) {
    return {
      transferable: false,
      reason: "existing_transfer_blocked",
      reasonLabel: POD_PAYOUT_TRANSFERABILITY_REASON_LABELS.existing_transfer_blocked,
      ensureDecision: null,
    };
  }

  const vendorGate = resolveVendorPayoutGateForPayment(input.paymentAllocations);
  if (!vendorGate.handled) {
    const reason =
      vendorGate.reason === "no_vendor_allocations"
        ? "no_vendor_allocations"
        : "waiting_on_vendor_transfer";
    return {
      transferable: false,
      reason,
      reasonLabel: POD_PAYOUT_TRANSFERABILITY_REASON_LABELS[reason],
      ensureDecision: null,
    };
  }

  const ensureDecision = resolvePodPayoutTransferEnsureDecision({
    allocationStatus: input.allocationStatus,
    podPayoutAmountCents: input.podPayoutAmountCents,
    minimumPayoutCents: input.minimumPayoutCents,
    paymentRefundStatus: input.paymentRefundStatus,
    recipientConnect: input.recipientConnect,
  });

  if (!ensureDecision) {
    return {
      transferable: false,
      reason: "unknown",
      reasonLabel: POD_PAYOUT_TRANSFERABILITY_REASON_LABELS.unknown,
      ensureDecision: null,
    };
  }

  const reason = reasonFromEnsureStatus(ensureDecision.status);
  const transferable = ensureDecision.status === POD_PAYOUT_TRANSFER_STATUS.pending;

  if (!transferable && reason === "unknown") {
    return {
      transferable: false,
      reason: "vendor_paid_unexpected_block",
      reasonLabel: POD_PAYOUT_TRANSFERABILITY_REASON_LABELS.vendor_paid_unexpected_block,
      ensureDecision,
    };
  }

  return {
    transferable,
    reason,
    reasonLabel: POD_PAYOUT_TRANSFERABILITY_REASON_LABELS[reason],
    ensureDecision,
  };
}

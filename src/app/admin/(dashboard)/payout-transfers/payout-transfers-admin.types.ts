import type { PlatformPayoutDisplayStatus } from "@/lib/stripe-money-movement";
import type { TransferClawbackBadgeKind } from "@/lib/admin-payout-transfer-clawback-badge";

export type AdminPayoutTransferRow = {
  id: string;
  paymentAllocationId: string;
  vendorOrderId: string;
  vendorId: string;
  destinationAccountId: string;
  amountCents: number;
  currency: string;
  status: string;
  blockedReason: string | null;
  stripeTransferId: string | null;
  idempotencyKey: string;
  batchKey: string | null;
  failureMessage: string | null;
  createdAt: string;
  submittedAt: string | null;
  failedAt: string | null;
  vendor: { id: string; name: string };
  vendorOrder: { id: string; orderId: string };
  /** Compact admin clawback state when refund/reversal applies (null = no badge). */
  clawbackBadge: TransferClawbackBadgeKind | null;
  legacyClawbackReviewStatus: string | null;
  legacyClawbackReviewNote: string | null;
  legacyClawbackReviewedAt: string | null;
  legacyClawbackReviewedBy: string | null;
  financialReviewKind: "manual" | "legacy" | null;
  stripeChargeId: string | null;
  moneyMovement: {
    customerPaymentCents: number;
    stripeProcessingFeeCents: number | null;
    stripeNetToPlatformCents: number | null;
    vendorConnectTransferOwedCents: number;
    vendorStillOwedCents: number;
    openOrderRetainedCents: number;
    stripeBalanceTransactionId: string | null;
    platformPayout: PlatformPayoutDisplayStatus;
  } | null;
};

export type AdminTransferReversalRow = {
  id: string;
  vendorPayoutTransferId: string;
  vendorOrderId: string;
  orderId: string;
  refundAttemptId: string;
  amountCents: number;
  currency: string;
  status: string;
  stripeTransferReversalId: string | null;
  failureMessage: string | null;
  batchKey: string | null;
  createdAt: string;
  submittedAt: string | null;
  failedAt: string | null;
  vendorId: string;
  vendor: { id: string; name: string };
  vendorOrder: { id: string; orderId: string };
  order: { id: string };
};

export type AdminVendorOption = { id: string; name: string };

export type AdminPodOption = { id: string; name: string };

export type AdminPodPayoutTransferRow = {
  id: string;
  podId: string;
  podName: string;
  orderId: string;
  amountCents: number;
  currency: string;
  destinationAccountId: string | null;
  status: string;
  statusLabel: string;
  stripeTransferId: string | null;
  blockedReason: string | null;
  blockedReasonLabel: string | null;
  failureMessage: string | null;
  batchKey: string | null;
  createdAt: string;
  submittedAt: string | null;
  paidAt: string | null;
  revenueShareBps: number;
  recipientEmail: string | null;
  recipientUserId: string | null;
};

export type PodPayoutGlobalSummary = {
  needsActionCount: number;
  needsActionAmountCents: number;
  readyToTransferCount: number;
  readyToTransferAmountCents: number;
  blockedCount: number;
  blockedAmountCents: number;
  paidCount: number;
  paidAmountCents: number;
};

export type PayoutCategoryTab = "all" | "vendors" | "pods" | "blocked";

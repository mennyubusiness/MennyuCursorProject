/**
 * Admin order detail: vendor Connect transfer attention classification (UX only).
 * Supports manual operation today; copy switches when automation is enabled later.
 */
import { isVendorConnectTransferPaid } from "@/lib/stripe-money-movement";
import {
  isCancelledDueToRefundTransfer,
  isPartialRefundManualReviewTransfer,
} from "@/lib/vendor-payout-transfer-refund-eligibility";
import {
  IDEMPOTENCY_MISMATCH_STATUS,
  INSUFFICIENT_BALANCE_STATUS,
  isIdempotencyMismatchTransfer,
  isInsufficientBalanceTransfer,
} from "@/lib/vendor-payout-transfer-failure";
import type { AdminOrderHealthAction, AdminOrderHealthState } from "@/lib/admin-order-health";

export type VendorTransfersAutomationMode = "manual" | "scheduled";

/** Switch to `scheduled` when automated vendor transfer runs are live. */
export const VENDOR_TRANSFERS_AUTOMATION_MODE: VendorTransfersAutomationMode = "manual";

export type VendorTransferAttentionKind = "pending" | "blocked" | "failed";

export type VendorTransferRowForAttention = {
  transferStatus: string | null;
  stripeTransferId: string | null;
  vendorName: string;
};

export function classifyVendorTransferAttention(
  row: VendorTransferRowForAttention
): VendorTransferAttentionKind | null {
  const status = row.transferStatus ?? "missing";

  if (isCancelledDueToRefundTransfer({ status })) return null;
  if (isVendorConnectTransferPaid(status, row.stripeTransferId)) return null;

  if (status === "failed") return "failed";

  if (isBlockedVendorTransferStatus(status)) return "blocked";

  if (status === "pending" || status === "submitted") return "pending";

  return null;
}

function isBlockedVendorTransferStatus(status: string): boolean {
  if (status === "blocked") return true;
  if (status === INSUFFICIENT_BALANCE_STATUS) return true;
  if (status === IDEMPOTENCY_MISMATCH_STATUS) return true;
  if (isPartialRefundManualReviewTransfer({ status })) return true;
  if (isInsufficientBalanceTransfer({ status })) return true;
  if (isIdempotencyMismatchTransfer({ status })) return true;
  return false;
}

function blockedTransferExplanation(status: string): string {
  if (isInsufficientBalanceTransfer({ status })) {
    return "Stripe available balance is not enough to send this vendor transfer yet. Check balance on Vendor Transfers.";
  }
  if (isIdempotencyMismatchTransfer({ status })) {
    return "Stripe rejected a retry because the idempotency key was reused with different parameters. Reconcile on Vendor Transfers before retrying.";
  }
  if (isPartialRefundManualReviewTransfer({ status })) {
    return "A partial customer refund requires manual review before this vendor transfer can be sent.";
  }
  return "This vendor transfer cannot be sent yet. Review the reason on Vendor Transfers.";
}

function pendingTransferBody(): string {
  if (VENDOR_TRANSFERS_AUTOMATION_MODE === "scheduled") {
    return "This vendor transfer is waiting for the next automated transfer run.";
  }
  return "This vendor transfer has not been sent yet. Open Vendor Transfers to send or review it.";
}

const openVendorTransfersAction: AdminOrderHealthAction = {
  label: "Open Vendor Transfers",
  href: "/admin/payout-transfers",
  primary: true,
};

/**
 * Highest-priority vendor transfer issue for the order attention card (if any).
 */
export function buildVendorTransferAttentionState(
  vendorOrders: VendorTransferRowForAttention[]
): AdminOrderHealthState | null {
  const rows = vendorOrders
    .map((vo) => ({ vo, kind: classifyVendorTransferAttention(vo) }))
    .filter((r): r is { vo: VendorTransferRowForAttention; kind: VendorTransferAttentionKind } =>
      r.kind !== null
    );

  if (rows.length === 0) return null;

  const failed = rows.find((r) => r.kind === "failed");
  if (failed) {
    const status = failed.vo.transferStatus ?? "failed";
    return {
      status: "attention",
      tone: "urgent",
      title: "Vendor transfer failed",
      explanation:
        status === "failed"
          ? "Open Order tried to send this vendor transfer, but Stripe rejected it or the transfer failed. Review and retry from Vendor Transfers."
          : "Open Order tried to send this vendor transfer, but it failed. Review and retry from Vendor Transfers.",
      actions: [openVendorTransfersAction],
    };
  }

  const blocked = rows.find((r) => r.kind === "blocked");
  if (blocked) {
    const status = blocked.vo.transferStatus ?? "blocked";
    return {
      status: "attention",
      tone: "urgent",
      title: "Vendor transfer blocked",
      explanation: blockedTransferExplanation(status),
      actions: [
        openVendorTransfersAction,
        { label: "Review payments & refunds", href: "#payments-refunds" },
      ],
    };
  }

  const pending = rows.filter((r) => r.kind === "pending");
  if (pending.length > 0) {
    const names = pending.map((r) => r.vo.vendorName).filter(Boolean);
    const vendorNote =
      names.length === 1
        ? `${names[0]} has not been paid via Connect yet.`
        : `${pending.length} vendors have not been paid via Connect yet.`;
    return {
      status: "attention",
      tone: "neutral",
      title: "Vendor transfer pending",
      explanation: `${pendingTransferBody()} ${vendorNote}`,
      actions: [openVendorTransfersAction],
    };
  }

  return null;
}

/**
 * Admin order detail: plain-English health summary for the "What needs attention?" card.
 * Presentation only — does not change financial or routing logic.
 */
import { isActiveOrderIssueStatus, customerSupportIssueTypeLabel } from "@/domain/order-support-issue";
import type { ExceptionType } from "@/lib/admin-exceptions";
import { fulfillmentStatusBadge, paymentChipLabel } from "@/lib/admin-order-detail-ui";
import type { AdminOrderPaymentSummary } from "@/services/admin-order-payment-summary.service";

export type AdminOrderHealthAction = {
  label: string;
  href: string;
  primary?: boolean;
};

export type AdminOrderFinancialReviewContext = {
  vendorPayoutTransferId: string;
  stripeTransferId: string | null;
  reviewKind: "manual" | "legacy";
  review: {
    status: string | null;
    note: string | null;
    reviewedAt: string | null;
    reviewedBy: string | null;
    needsReview: boolean;
  };
};

export type AdminOrderHealthState = {
  status: "ok" | "attention";
  title: string;
  explanation: string;
  actions: AdminOrderHealthAction[];
  secondaryNotes?: string[];
  financialReview?: AdminOrderFinancialReviewContext;
};

type CustomerIssueInput = {
  id: string;
  issueType: string;
  status: string;
  customerMessage: string | null;
  vendorName: string | null;
};

type VendorRecoveryInput = {
  vendorOrderId: string;
  vendorName: string;
  exceptionType: ExceptionType;
  reason: string | null;
};

type VendorOrderInput = {
  id: string;
  routingStatus: string;
  fulfillmentStatus: string;
};

function vendorNeedsOpenFinancialReview(
  v: AdminOrderPaymentSummary["vendorOrders"][number]
): boolean {
  return Boolean(v.legacyClawbackReview?.needsReview);
}

export function orderHasUnresolvedClawback(summary: AdminOrderPaymentSummary | null): boolean {
  if (!summary) return false;
  return summary.vendorOrders.some((v) => {
    if (vendorNeedsOpenFinancialReview(v)) return true;
    if (v.clawback.clawbackStatus === "failed") return true;
    if (v.clawback.clawbackStatus === "pending") return true;
    if (v.clawback.hasMissingReversalSetup && v.reversalPrepare.canPrepare) return true;
    if (
      v.clawback.hasMissingReversalSetup ||
      (v.clawback.clawbackStatus === "manual_review" && v.clawback.clawbackRequiredCents > 0)
    ) {
      return v.clawback.clawbackStatus !== "recovered";
    }
    return false;
  });
}

export function buildOrderHeaderSubtitle(input: {
  orderStatus: string;
  paymentRefundStatus: string | null;
  vendorOrders: VendorOrderInput[];
  paymentSummary: AdminOrderPaymentSummary | null;
}): string {
  const parts: string[] = [];
  const statusLabel =
    input.orderStatus === "completed"
      ? "Completed"
      : input.orderStatus === "cancelled"
        ? "Cancelled"
        : input.orderStatus === "pending_payment"
          ? "Awaiting payment"
          : "In progress";
  parts.push(statusLabel);

  const pay = paymentChipLabel(input.orderStatus, input.paymentRefundStatus);
  if (pay !== "Paid") parts.push(pay);

  if (input.vendorOrders.length > 0) {
    parts.push(
      `${input.vendorOrders.length} vendor${input.vendorOrders.length === 1 ? "" : "s"}`
    );
  }

  const clawback = summarizeClawbackForHeader(input.paymentSummary);
  if (clawback) parts.push(clawback);

  return parts.join(" · ");
}

function summarizeClawbackForHeader(summary: AdminOrderPaymentSummary | null): string | null {
  if (!summary) return null;
  const rows = summary.vendorOrders.filter((v) => v.clawback.clawbackStatus !== "not_needed");
  if (rows.length === 0) return null;
  if (rows.every((v) => v.clawback.clawbackStatus === "recovered")) {
    return "Vendor clawback recovered";
  }
  if (rows.some((v) => v.legacyClawbackReview?.needsReview)) {
    const manual = rows.some((v) => v.legacyClawbackReview?.kind === "manual");
    return manual ? "Manual financial review" : "Legacy clawback review";
  }
  if (rows.some((v) => v.clawback.clawbackStatus === "manual_review")) {
    return "Manual financial review";
  }
  if (rows.some((v) => v.clawback.clawbackStatus === "failed")) {
    return "Vendor clawback failed";
  }
  if (rows.some((v) => v.clawback.clawbackStatus === "pending")) {
    return "Vendor clawback pending";
  }
  if (rows.some((v) => v.clawback.hasMissingReversalSetup)) {
    return "Vendor clawback needs attention";
  }
  return null;
}

export function buildAdminOrderHealth(input: {
  orderStatus: string;
  paymentRefundStatus: string | null;
  paymentSummary: AdminOrderPaymentSummary | null;
  customerSupportIssues: CustomerIssueInput[];
  vendorRecoveryContexts: VendorRecoveryInput[];
}): AdminOrderHealthState {
  const openCustomer = input.customerSupportIssues.filter((i) =>
    isActiveOrderIssueStatus(i.status)
  );
  if (openCustomer.length > 0) {
    const issue = openCustomer[0]!;
    const typeLabel = customerSupportIssueTypeLabel(issue.issueType);
    return {
      status: "attention",
      title: "Customer needs help",
      explanation: issue.customerMessage?.trim()
        ? issue.customerMessage.trim()
        : `Customer reported: ${typeLabel}${issue.vendorName ? ` (${issue.vendorName})` : ""}.`,
      actions: [
        { label: "Review customer issue", href: "#notes-issues", primary: true },
        { label: "Show technical details", href: "#technical-details" },
      ],
      secondaryNotes:
        openCustomer.length > 1
          ? [`${openCustomer.length - 1} more open customer issue(s) below.`]
          : undefined,
    };
  }

  const routing = input.vendorRecoveryContexts.find(
    (c) => c.exceptionType === "routing_failed" || c.exceptionType === "routing_stuck"
  );
  if (routing) {
    return {
      status: "attention",
      title: "Vendor did not receive order",
      explanation:
        routing.reason ??
        `${routing.vendorName} may not have the order in their kitchen system yet. Retry routing or confirm manually with the vendor.`,
      actions: [
        {
          label: "Review vendor order",
          href: `#vendor-order-${routing.vendorOrderId}`,
          primary: true,
        },
        { label: "Show technical routing details", href: `#vendor-order-${routing.vendorOrderId}` },
      ],
    };
  }

  if (input.paymentSummary) {
    const failedLedger = input.paymentSummary.orderRefunds.filter((r) => r.status === "failed");
    if (failedLedger.length > 0) {
      return {
        status: "attention",
        title: "Refund failed",
        explanation:
          "A customer refund could not be completed. Review the refund ledger and Stripe before retrying.",
        actions: [
          { label: "Review payments & refunds", href: "#payments-refunds", primary: true },
          { label: "Show technical details", href: "#technical-details" },
        ],
      };
    }
  }

  if (input.paymentSummary) {
    const financialReviewVendor = input.paymentSummary.vendorOrders.find((v) =>
      vendorNeedsOpenFinancialReview(v)
    );
    if (financialReviewVendor?.legacyClawbackReview?.needsReview) {
      const kind = financialReviewVendor.legacyClawbackReview.kind ?? "manual";
      const isLegacy = kind === "legacy";
      return {
        status: "attention",
        title: isLegacy ? "Legacy clawback review required" : "Manual financial review needed",
        explanation: isLegacy
          ? "The customer appears refunded and the vendor was paid, but refund records are incomplete. Review Stripe manually before preparing a transfer reversal."
          : "This order has a partial or non-standard refund after the vendor was paid. Automatic vendor reversal is not supported for this case. Review manually.",
        actions: [
          { label: "Open Vendor Transfers", href: "/admin/payout-transfers", primary: true },
          { label: "Review payments & refunds", href: "#payments-refunds" },
        ],
        financialReview: {
          vendorPayoutTransferId: financialReviewVendor.vendorPayoutTransferId!,
          stripeTransferId: financialReviewVendor.stripeTransferId,
          reviewKind: kind,
          review: {
            status: financialReviewVendor.legacyClawbackReview.status,
            note: financialReviewVendor.legacyClawbackReview.note,
            reviewedAt: financialReviewVendor.legacyClawbackReview.reviewedAt,
            reviewedBy: financialReviewVendor.legacyClawbackReview.reviewedBy,
            needsReview: true,
          },
        },
      };
    }
  }

  if (input.paymentSummary && orderHasUnresolvedClawback(input.paymentSummary)) {
    const missing = input.paymentSummary.vendorOrders.some(
      (v) => v.reversalPrepare.canPrepare || v.clawback.hasMissingReversalSetup
    );
    const failed = input.paymentSummary.vendorOrders.some((v) => v.clawback.clawbackStatus === "failed");
    const pending = input.paymentSummary.vendorOrders.some((v) => v.clawback.clawbackStatus === "pending");

    if (failed) {
      return {
        status: "attention",
        title: "Vendor clawback failed",
        explanation:
          "The customer was refunded, but recovering funds from the vendor transfer failed. Retry from Vendor Transfers.",
        actions: [
          { label: "Open Vendor Transfers", href: "/admin/payout-transfers", primary: true },
          { label: "Review payments & refunds", href: "#payments-refunds" },
        ],
      };
    }

    if (pending) {
      return {
        status: "attention",
        title: "Vendor clawback pending",
        explanation:
          "A vendor transfer reversal is prepared but not completed. Run it from Vendor Transfers.",
        actions: [
          { label: "Open Vendor Transfers", href: "/admin/payout-transfers", primary: true },
          { label: "Review payments & refunds", href: "#payments-refunds" },
        ],
      };
    }

    if (missing) {
      return {
        status: "attention",
        title: "Vendor clawback missing",
        explanation:
          "The customer was refunded after the vendor was paid. Vendor funds must be recovered through a transfer reversal.",
        actions: [
          { label: "Open Vendor Transfers", href: "/admin/payout-transfers", primary: true },
          { label: "Review payments & refunds", href: "#payments-refunds" },
        ],
      };
    }
  }

  const blockedTransfer = input.paymentSummary?.vendorOrders.some(
    (v) => v.transferStatus === "blocked" || (v.vendorStillOwedCents ?? 0) > 0
  );
  if (blockedTransfer) {
    return {
      status: "attention",
      title: "Vendor transfer blocked",
      explanation:
        "At least one vendor transfer could not be sent. Review vendor Connect setup or reconciliation.",
      actions: [
        { label: "Review payments & refunds", href: "#payments-refunds", primary: true },
        { label: "Open Vendor Transfers", href: "/admin/payout-transfers" },
      ],
    };
  }

  const allRecovered =
    input.paymentSummary &&
    input.paymentRefundStatus === "fully_refunded" &&
    input.paymentSummary.vendorOrders.every(
      (v) => v.clawback.clawbackStatus === "not_needed" || v.clawback.clawbackStatus === "recovered"
    );

  if (allRecovered) {
    return {
      status: "ok",
      title: "All financial recovery complete",
      explanation:
        "This order is fully refunded and any required vendor clawback has been recovered.",
      actions: [{ label: "Review payments & refunds", href: "#payments-refunds" }],
    };
  }

  if (input.orderStatus === "completed") {
    const hasOpenFinancialReview = input.paymentSummary?.vendorOrders.some((v) =>
      vendorNeedsOpenFinancialReview(v)
    );
    const allDone = input.paymentSummary?.vendorOrders.every(
      (v) => fulfillmentStatusBadge(v.fulfillmentStatus).label === "Completed"
    );
    if (allDone !== false && !hasOpenFinancialReview) {
      return {
        status: "ok",
        title: "No action needed",
        explanation:
          "This order is completed and payment/vendor recovery steps look resolved.",
        actions: [],
      };
    }
  }

  return {
    status: "ok",
    title: "No urgent action",
    explanation: "No critical issues detected. Expand sections below for details or debugging.",
    actions: [],
  };
}

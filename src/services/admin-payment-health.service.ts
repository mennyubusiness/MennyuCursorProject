/**
 * Read-only payment/checkout health detection for admin triage.
 */
import "server-only";

import { PaymentStatus, type OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { HEALTH_WINDOW_24H_MS, INCIDENT_LOOKBACK_DAYS } from "@/lib/admin-health-thresholds";
import { VENDOR_PAYOUT_TRANSFER_STATUS } from "@/services/vendor-payout-transfer.service";
import { POD_PAYOUT_TRANSFER_STATUS } from "@/lib/pod-payout-transfer-decision";

export type AdminPaymentHealthIssueType =
  | "payment_succeeded_order_failed"
  | "payment_succeeded_order_missing"
  | "order_paid_payment_missing"
  | "payment_intent_mismatch"
  | "payment_amount_mismatch"
  | "order_missing_allocations"
  | "vendor_transfer_blocked"
  | "refund_review_required";

export type AdminPaymentHealthRow = {
  id: string;
  issueType: AdminPaymentHealthIssueType;
  orderId: string | null;
  paymentId: string | null;
  stripePaymentIntentId: string | null;
  amountCents: number | null;
  currency: string;
  status: string;
  description: string;
  detectedAt: Date;
  adminHref: string;
};

const TERMINAL_ORDER_FAILURE = new Set(["failed", "cancelled"]);
const PAID_ORDER_STATUSES: OrderStatus[] = [
  "paid",
  "routing",
  "routed_partial",
  "routed",
  "accepted",
  "preparing",
  "ready",
  "completed",
  "in_progress",
  "partially_completed",
];

function lookbackStart(): Date {
  return new Date(Date.now() - INCIDENT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
}

export async function detectPaymentHealthIssues(limit = 100): Promise<AdminPaymentHealthRow[]> {
  const since = lookbackStart();
  const rows: AdminPaymentHealthRow[] = [];

  const succeededPayments = await prisma.payment.findMany({
    where: {
      status: PaymentStatus.succeeded,
      createdAt: { gte: since },
    },
    select: {
      id: true,
      orderId: true,
      stripePaymentIntentId: true,
      amountCents: true,
      status: true,
      createdAt: true,
      order: {
        select: {
          id: true,
          status: true,
          totalCents: true,
          stripePaymentIntentId: true,
        },
      },
      allocations: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  for (const payment of succeededPayments) {
    const order = payment.order;
    if (!order) {
      rows.push({
        id: `payment_missing_order:${payment.id}`,
        issueType: "payment_succeeded_order_missing",
        orderId: payment.orderId,
        paymentId: payment.id,
        stripePaymentIntentId: payment.stripePaymentIntentId,
        amountCents: payment.amountCents,
        currency: "usd",
        status: payment.status,
        description: "Payment succeeded but linked order row is missing.",
        detectedAt: payment.createdAt,
        adminHref: `/admin/orders/${payment.orderId}`,
      });
      continue;
    }

    if (TERMINAL_ORDER_FAILURE.has(order.status)) {
      rows.push({
        id: `payment_order_failed:${payment.id}`,
        issueType: "payment_succeeded_order_failed",
        orderId: order.id,
        paymentId: payment.id,
        stripePaymentIntentId: payment.stripePaymentIntentId,
        amountCents: payment.amountCents,
        currency: "usd",
        status: `${payment.status} / order ${order.status}`,
        description: "Payment succeeded but parent order is failed or cancelled.",
        detectedAt: payment.createdAt,
        adminHref: `/admin/orders/${order.id}#payments-refunds`,
      });
    }

    if (
      order.stripePaymentIntentId &&
      order.stripePaymentIntentId !== payment.stripePaymentIntentId
    ) {
      rows.push({
        id: `payment_intent_mismatch:${payment.id}`,
        issueType: "payment_intent_mismatch",
        orderId: order.id,
        paymentId: payment.id,
        stripePaymentIntentId: payment.stripePaymentIntentId,
        amountCents: payment.amountCents,
        currency: "usd",
        status: payment.status,
        description: "Order PaymentIntent ID does not match payment record.",
        detectedAt: payment.createdAt,
        adminHref: `/admin/orders/${order.id}#payments-refunds`,
      });
    }

    if (payment.amountCents !== order.totalCents) {
      rows.push({
        id: `payment_amount_mismatch:${payment.id}`,
        issueType: "payment_amount_mismatch",
        orderId: order.id,
        paymentId: payment.id,
        stripePaymentIntentId: payment.stripePaymentIntentId,
        amountCents: payment.amountCents,
        currency: "usd",
        status: payment.status,
        description: `Payment amount (${payment.amountCents}c) differs from order total (${order.totalCents}c).`,
        detectedAt: payment.createdAt,
        adminHref: `/admin/orders/${order.id}#payments-refunds`,
      });
    }

    if (PAID_ORDER_STATUSES.includes(order.status as OrderStatus) && payment.allocations.length === 0) {
      rows.push({
        id: `payment_missing_allocations:${payment.id}`,
        issueType: "order_missing_allocations",
        orderId: order.id,
        paymentId: payment.id,
        stripePaymentIntentId: payment.stripePaymentIntentId,
        amountCents: payment.amountCents,
        currency: "usd",
        status: payment.status,
        description: "Paid order has no vendor payment allocations.",
        detectedAt: payment.createdAt,
        adminHref: `/admin/orders/${order.id}#payments-refunds`,
      });
    }
  }

  const paidOrdersWithoutPayment = await prisma.order.findMany({
    where: {
      createdAt: { gte: since },
      status: { in: PAID_ORDER_STATUSES },
      payments: { none: { status: PaymentStatus.succeeded } },
    },
    select: {
      id: true,
      status: true,
      totalCents: true,
      stripePaymentIntentId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: Math.max(0, limit - rows.length),
  });

  for (const order of paidOrdersWithoutPayment) {
    rows.push({
      id: `order_missing_payment:${order.id}`,
      issueType: "order_paid_payment_missing",
      orderId: order.id,
      paymentId: null,
      stripePaymentIntentId: order.stripePaymentIntentId,
      amountCents: order.totalCents,
      currency: "usd",
      status: order.status,
      description: "Order is past checkout but has no succeeded payment record.",
      detectedAt: order.createdAt,
      adminHref: `/admin/orders/${order.id}#payments-refunds`,
    });
  }

  return rows.slice(0, limit);
}

export async function countPaymentHealthIssues(): Promise<{
  paymentSucceededOrderFailed: number;
  orderPaidPaymentMissing: number;
  paymentMismatch: number;
  vendorTransfersBlocked: number;
  podTransfersBlocked: number;
  refundReviewRequired: number;
}> {
  const since = lookbackStart();
  const last24h = new Date(Date.now() - HEALTH_WINDOW_24H_MS);

  const [
    paymentSucceededOrderFailed,
    orderPaidPaymentMissing,
    paymentIntentMismatch,
    paymentAmountMismatch,
    vendorTransfersBlocked,
    podTransfersBlocked,
    refundReviewRequired,
  ] = await Promise.all([
    prisma.payment.count({
      where: {
        status: PaymentStatus.succeeded,
        createdAt: { gte: since },
        order: { status: { in: ["failed", "cancelled"] } },
      },
    }),
    prisma.order.count({
      where: {
        createdAt: { gte: since },
        status: { notIn: ["pending_payment"] },
        payments: { none: { status: PaymentStatus.succeeded } },
      },
    }),
    (async () => {
      const rows = await prisma.payment.findMany({
        where: {
          status: PaymentStatus.succeeded,
          createdAt: { gte: since },
          order: { stripePaymentIntentId: { not: null } },
        },
        select: {
          stripePaymentIntentId: true,
          order: { select: { stripePaymentIntentId: true } },
        },
        take: 500,
      });
      return rows.filter(
        (p) =>
          p.order.stripePaymentIntentId &&
          p.order.stripePaymentIntentId !== p.stripePaymentIntentId
      ).length;
    })(),
    prisma.payment.count({
      where: {
        status: PaymentStatus.succeeded,
        createdAt: { gte: since },
      },
    }).then(async () => {
      const rows = await prisma.payment.findMany({
        where: { status: PaymentStatus.succeeded, createdAt: { gte: since } },
        select: { amountCents: true, order: { select: { totalCents: true } } },
        take: 500,
      });
      return rows.filter((p) => p.amountCents !== p.order.totalCents).length;
    }),
    prisma.vendorPayoutTransfer.count({
      where: {
        status: {
          in: [
            VENDOR_PAYOUT_TRANSFER_STATUS.blocked,
            VENDOR_PAYOUT_TRANSFER_STATUS.blockedInsufficientBalance,
            VENDOR_PAYOUT_TRANSFER_STATUS.blockedPartialRefundReview,
          ],
        },
        updatedAt: { gte: last24h },
      },
    }),
    prisma.podPayoutTransfer.count({
      where: {
        status: {
          in: [
            POD_PAYOUT_TRANSFER_STATUS.blocked,
            POD_PAYOUT_TRANSFER_STATUS.blockedInsufficientBalance,
            POD_PAYOUT_TRANSFER_STATUS.blockedConnectNotReady,
            POD_PAYOUT_TRANSFER_STATUS.blockedBelowMinimum,
            POD_PAYOUT_TRANSFER_STATUS.blockedPartialRefundReview,
            POD_PAYOUT_TRANSFER_STATUS.blockedIdempotencyMismatch,
            POD_PAYOUT_TRANSFER_STATUS.failed,
          ],
        },
        updatedAt: { gte: last24h },
      },
    }),
    prisma.orderRefund.count({
      where: {
        status: "pending",
        initiatedByRole: { not: "admin" },
        stripeRefundId: null,
        adminNote: { contains: "Awaiting platform admin review" },
        createdAt: { gte: since },
      },
    }),
  ]);

  return {
    paymentSucceededOrderFailed,
    orderPaidPaymentMissing,
    paymentMismatch: paymentIntentMismatch + paymentAmountMismatch,
    vendorTransfersBlocked,
    podTransfersBlocked,
    refundReviewRequired: refundReviewRequired,
  };
}

export function paymentHealthIssueLabel(type: AdminPaymentHealthIssueType): string {
  switch (type) {
    case "payment_succeeded_order_failed":
      return "Payment succeeded, order failed";
    case "payment_succeeded_order_missing":
      return "Payment succeeded, order missing";
    case "order_paid_payment_missing":
      return "Order paid, payment missing";
    case "payment_intent_mismatch":
      return "PaymentIntent mismatch";
    case "payment_amount_mismatch":
      return "Payment amount mismatch";
    case "order_missing_allocations":
      return "Missing vendor allocations";
    case "vendor_transfer_blocked":
      return "Vendor transfer blocked";
    case "refund_review_required":
      return "Refund needs review";
    default:
      return type;
  }
}

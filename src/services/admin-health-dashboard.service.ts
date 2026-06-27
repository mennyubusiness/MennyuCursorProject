/**
 * Admin operational health dashboard aggregates — bounded queries for /admin/health.
 */
import "server-only";

import { VendorFulfillmentStatus, VendorRoutingStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ROUTING_STUCK_THRESHOLD_MINUTES } from "@/lib/admin-exceptions";
import {
  HEALTH_WINDOW_1H_MS,
  HEALTH_WINDOW_24H_MS,
  ORDER_PENDING_PAYMENT_STUCK_MINUTES,
  VENDOR_ACCEPTED_PREPARING_STUCK_MINUTES,
  VENDOR_FULFILLMENT_PENDING_STUCK_MINUTES,
  VENDOR_READY_STUCK_MINUTES,
} from "@/lib/admin-health-thresholds";
import { getAttentionItems } from "@/lib/admin-attention";
import { countPaymentHealthIssues } from "@/services/admin-payment-health.service";
import { countSmsHealthMetrics } from "@/services/admin-notification-search.service";
import { getAdminWebhookHealthSummary } from "@/services/admin-webhook-health.service";
import { ACTIVE_ORDER_ISSUE_STATUSES } from "@/domain/order-support-issue";

export type AdminHealthMetricTone = "default" | "warning" | "critical";

export type AdminHealthMetric = {
  id: string;
  label: string;
  description: string;
  /** null = metric not tracked */
  count: number | null;
  tone: AdminHealthMetricTone;
  href?: string;
};

export type AdminHealthSection = {
  id: string;
  title: string;
  metrics: AdminHealthMetric[];
};

export type AdminHealthDashboard = {
  generatedAt: Date;
  criticalNow: AdminHealthMetric[];
  sections: AdminHealthSection[];
};

function metric(
  id: string,
  label: string,
  description: string,
  count: number | null,
  opts?: { tone?: AdminHealthMetricTone; href?: string }
): AdminHealthMetric {
  const tone =
    opts?.tone ??
    (count != null && count > 0 ? "warning" : "default");
  return { id, label, description, count, tone, href: opts?.href };
}

export async function getAdminHealthDashboard(): Promise<AdminHealthDashboard> {
  const now = Date.now();
  const since1h = new Date(now - HEALTH_WINDOW_1H_MS);
  const since24h = new Date(now - HEALTH_WINDOW_24H_MS);
  const routingStuckBefore = new Date(now - ROUTING_STUCK_THRESHOLD_MINUTES * 60 * 1000);
  const pendingPaymentStuckBefore = new Date(now - ORDER_PENDING_PAYMENT_STUCK_MINUTES * 60 * 1000);
  const fulfillmentPendingStuckBefore = new Date(now - VENDOR_FULFILLMENT_PENDING_STUCK_MINUTES * 60 * 1000);
  const acceptedPreparingStuckBefore = new Date(now - VENDOR_ACCEPTED_PREPARING_STUCK_MINUTES * 60 * 1000);
  const readyStuckBefore = new Date(now - VENDOR_READY_STUCK_MINUTES * 60 * 1000);

  const [
    attentionItems,
    ordersLast1h,
    ordersLast24h,
    stuckPendingPayment,
    routingFailed,
    routingStuck,
    fulfillmentPendingStuck,
    acceptedPreparingStuck,
    readyStuck,
    openOrderIssues,
    paymentCounts,
    smsCounts,
    webhookSummary,
    vendorsPaused,
    vendorsHidden,
    vendorsStripeIncomplete,
    podsPaused,
    podsHidden,
    podsPublicNoActiveVendors,
    emailFailures,
    checkoutFailures,
  ] = await Promise.all([
    getAttentionItems(),
    prisma.order.count({ where: { createdAt: { gte: since1h } } }),
    prisma.order.count({ where: { createdAt: { gte: since24h } } }),
    prisma.order.count({
      where: {
        status: "pending_payment",
        createdAt: { lt: pendingPaymentStuckBefore },
      },
    }),
    prisma.vendorOrder.count({
      where: {
        routingStatus: VendorRoutingStatus.failed,
        fulfillmentStatus: VendorFulfillmentStatus.pending,
      },
    }),
    prisma.vendorOrder.count({
      where: {
        routingStatus: VendorRoutingStatus.pending,
        fulfillmentStatus: VendorFulfillmentStatus.pending,
        createdAt: { lt: routingStuckBefore },
      },
    }),
    prisma.vendorOrder.count({
      where: {
        fulfillmentStatus: VendorFulfillmentStatus.pending,
        order: { status: { not: "pending_payment" } },
        createdAt: { lt: fulfillmentPendingStuckBefore },
      },
    }),
    prisma.vendorOrder.count({
      where: {
        fulfillmentStatus: { in: ["accepted", "preparing"] },
        updatedAt: { lt: acceptedPreparingStuckBefore },
      },
    }),
    prisma.vendorOrder.count({
      where: {
        fulfillmentStatus: VendorFulfillmentStatus.ready,
        updatedAt: { lt: readyStuckBefore },
      },
    }),
    prisma.orderIssue.count({
      where: { status: { in: [...ACTIVE_ORDER_ISSUE_STATUSES] } },
    }),
    countPaymentHealthIssues(),
    countSmsHealthMetrics(since24h),
    getAdminWebhookHealthSummary(),
    prisma.vendor.count({ where: { mennyuOrdersPaused: true, isActive: true } }),
    prisma.vendor.count({ where: { isActive: false } }),
    prisma.vendor.count({
      where: {
        isActive: true,
        OR: [
          { stripeConnectedAccountId: null },
          { stripeChargesEnabled: false },
          { stripePayoutsEnabled: false },
        ],
      },
    }),
    prisma.pod.count({ where: { mennyuOrdersPaused: true, isActive: true } }),
    prisma.pod.count({ where: { isActive: false } }),
    countPodsPublicWithNoOrderableVendors(),
    null as number | null,
    null as number | null,
  ]);

  const stuckOrdersTotal =
    stuckPendingPayment +
    routingFailed +
    routingStuck +
    fulfillmentPendingStuck +
    acceptedPreparingStuck +
    readyStuck;

  const criticalAttention = attentionItems.filter(
    (i) => i.severity === "critical" || i.severity === "high"
  ).length;

  const criticalNow: AdminHealthMetric[] = [
    metric("critical_attention", "Needs attention (critical/high)", "From unified attention queue", criticalAttention, {
      tone: criticalAttention > 0 ? "critical" : "default",
      href: "/admin/incidents?severity=critical",
    }),
    metric("stuck_orders", "Stuck orders", "Pending payment, routing, or fulfillment beyond thresholds", stuckOrdersTotal, {
      tone: stuckOrdersTotal > 0 ? "critical" : "default",
      href: "/admin/incidents?type=stuck_order",
    }),
    metric("routing_failed", "Routing failed", "Vendor orders with failed routing", routingFailed, {
      tone: routingFailed > 0 ? "critical" : "default",
      href: "/admin/incidents?type=routing_failed",
    }),
    metric("payment_mismatch", "Payment/checkout issues", "Succeeded payment vs order mismatches (7d)", paymentCounts.paymentSucceededOrderFailed + paymentCounts.orderPaidPaymentMissing + paymentCounts.paymentMismatch, {
      tone:
        paymentCounts.paymentSucceededOrderFailed + paymentCounts.orderPaidPaymentMissing > 0
          ? "critical"
          : "default",
      href: "/admin/incidents?type=payment",
    }),
    metric("sms_failures_24h", "SMS failures (24h)", "Failed or undelivered transactional SMS", smsCounts.failed, {
      tone: smsCounts.failed > 0 ? "warning" : "default",
      href: "/admin/notifications?status=failed",
    }),
    metric("webhook_failures_24h", "Webhook failures (24h)", "Stripe + Deliverect processing failures", webhookSummary.stripeFailed24h + webhookSummary.deliverectFailed24h, {
      tone:
        webhookSummary.stripeFailed24h + webhookSummary.deliverectFailed24h > 0 ? "warning" : "default",
      href: "/admin/webhooks?status=failed",
    }),
  ];

  const sections: AdminHealthSection[] = [
    {
      id: "orders",
      title: "Orders",
      metrics: [
        metric("orders_1h", "Created (1h)", "Orders created in the last hour", ordersLast1h, {
          href: "/admin/orders",
        }),
        metric("orders_24h", "Created (24h)", "Orders created in the last 24 hours", ordersLast24h, {
          href: "/admin/orders",
        }),
        metric("stuck_orders_detail", "Stuck beyond thresholds", "Pending payment, routing, fulfillment, ready", stuckOrdersTotal, {
          tone: stuckOrdersTotal > 0 ? "warning" : "default",
          href: "/admin/incidents?type=stuck_order",
        }),
        metric("routing_failed_detail", "Routing failed", "VendorOrder routingStatus failed", routingFailed, {
          tone: routingFailed > 0 ? "warning" : "default",
          href: "/admin/incidents?type=routing_failed",
        }),
        metric("open_issues", "Open order issues", "Customer or ops issues still open", openOrderIssues, {
          tone: openOrderIssues > 0 ? "warning" : "default",
          href: "/admin/exceptions",
        }),
        metric("vendor_sync", "Vendor orders out of sync", "Parent/child status mismatch detection", null, {
          href: "/admin/incidents?type=order_status_mismatch",
        }),
      ],
    },
    {
      id: "payments",
      title: "Payments / checkouts",
      metrics: [
        metric("checkout_failures", "Recent checkout failures", "Checkout failure tracking", checkoutFailures, {
          href: "/admin/incidents?type=payment",
        }),
        metric("payment_no_order", "Payment succeeded, order failed/missing", "Last 7 days", paymentCounts.paymentSucceededOrderFailed, {
          tone: paymentCounts.paymentSucceededOrderFailed > 0 ? "warning" : "default",
          href: "/admin/incidents?type=payment",
        }),
        metric("order_no_payment", "Order paid, payment missing", "Last 7 days", paymentCounts.orderPaidPaymentMissing, {
          tone: paymentCounts.orderPaidPaymentMissing > 0 ? "warning" : "default",
          href: "/admin/incidents?type=payment",
        }),
        metric("refund_review", "Refunds needing review", "Pending admin review refunds", paymentCounts.refundReviewRequired, {
          tone: paymentCounts.refundReviewRequired > 0 ? "warning" : "default",
          href: "/admin/exceptions",
        }),
        metric("transfers_blocked", "Vendor transfers blocked", "Blocked transfers in last 24h", paymentCounts.vendorTransfersBlocked, {
          tone: paymentCounts.vendorTransfersBlocked > 0 ? "warning" : "default",
          href: "/admin/payout-transfers",
        }),
      ],
    },
    {
      id: "vendors",
      title: "Vendors",
      metrics: [
        metric("vendors_paused", "Paused by admin", "mennyuOrdersPaused", vendorsPaused, {
          href: "/admin/vendors?status=paused",
        }),
        metric("vendors_hidden", "Hidden by admin", "isActive false", vendorsHidden, {
          href: "/admin/vendors?status=hidden",
        }),
        metric("vendors_stale_menu", "Stale / missing menu", "Menu readiness scan", null, {
          href: "/admin/vendors",
        }),
        metric("vendors_routing_failed", "Recent routing failures", "See incidents list", routingFailed, {
          href: "/admin/incidents?type=routing_failed",
        }),
        metric("vendors_no_items", "No visible orderable items", "Derived vendor incidents", null, {
          href: "/admin/incidents?type=vendor_no_items",
        }),
        metric("vendors_stripe", "Stripe setup incomplete", "Missing connect or charges/payouts disabled", vendorsStripeIncomplete, {
          tone: vendorsStripeIncomplete > 0 ? "warning" : "default",
          href: "/admin/vendors",
        }),
        metric("vendors_pos", "POS/menu status unavailable", "POS health tracking", null),
      ],
    },
    {
      id: "pods",
      title: "Pods",
      metrics: [
        metric("pods_paused", "Paused by admin", "mennyuOrdersPaused", podsPaused, {
          href: "/admin/pods?status=paused",
        }),
        metric("pods_hidden", "Hidden by admin", "isActive false", podsHidden, {
          href: "/admin/pods?status=hidden",
        }),
        metric("pods_no_vendors", "Zero orderable vendors", "Public pods with no orderable roster", podsPublicNoActiveVendors, {
          tone: podsPublicNoActiveVendors > 0 ? "warning" : "default",
          href: "/admin/incidents?type=pod_no_vendors",
        }),
        metric("pods_qr_stale", "Stale QR warning", "QR state tracking", null),
        metric("pods_readiness", "Readiness blockers", "See pod detail readiness", null, {
          href: "/admin/pods",
        }),
      ],
    },
    {
      id: "notifications",
      title: "SMS / notifications",
      metrics: [
        metric("sms_attempted", "SMS attempted (24h)", "All SmsMessageLog rows", smsCounts.attempted, {
          href: "/admin/notifications",
        }),
        metric("sms_failed", "SMS failures (24h)", "failed / undelivered", smsCounts.failed, {
          tone: smsCounts.failed > 0 ? "warning" : "default",
          href: "/admin/notifications?status=failed",
        }),
        metric("sms_consent", "Suppressed (no consent)", "Last 24h", smsCounts.suppressedConsent, {
          href: "/admin/notifications?status=suppressed",
        }),
        metric("sms_optout", "Suppressed (opt-out)", "Last 24h", smsCounts.suppressedOptOut, {
          href: "/admin/notifications?status=suppressed",
        }),
        metric("email_failures", "Email failures", "Receipt/order email failure tracking", emailFailures),
        metric("twilio_errors", "Recent Twilio errors", "Stored in SmsMessageLog errorCode", smsCounts.failed, {
          href: "/admin/notifications?status=failed",
        }),
      ],
    },
    {
      id: "webhooks",
      title: "Webhooks / integrations",
      metrics: [
        metric("stripe_webhook_failed", "Stripe failures (24h)", "WebhookEvent processing failed", webhookSummary.stripeFailed24h, {
          tone: webhookSummary.stripeFailed24h > 0 ? "warning" : "default",
          href: "/admin/webhooks?provider=stripe&status=failed",
        }),
        metric("deliverect_webhook_failed", "Deliverect failures (24h)", "WebhookEvent processing failed", webhookSummary.deliverectFailed24h, {
          tone: webhookSummary.deliverectFailed24h > 0 ? "warning" : "default",
          href: "/admin/webhooks?provider=deliverect&status=failed",
        }),
        metric(
          "webhook_last_stripe",
          "Last Stripe success",
          webhookSummary.stripeLastSuccessAt
            ? webhookSummary.stripeLastSuccessAt.toLocaleString()
            : "No successful Stripe webhook logged yet",
          webhookSummary.stripeLastSuccessAt ? 1 : 0,
          { href: "/admin/webhooks?provider=stripe" }
        ),
        metric(
          "webhook_last_deliverect",
          "Last Deliverect success",
          webhookSummary.deliverectLastSuccessAt
            ? webhookSummary.deliverectLastSuccessAt.toLocaleString()
            : "No successful Deliverect webhook logged yet",
          webhookSummary.deliverectLastSuccessAt ? 1 : 0,
          { href: "/admin/webhooks?provider=deliverect" }
        ),
        metric("webhook_backlog", "Webhook retry backlog", "Retry queue tracking", null),
      ],
    },
  ];

  return {
    generatedAt: new Date(),
    criticalNow,
    sections,
  };
}

async function countPodsPublicWithNoOrderableVendors(): Promise<number> {
  const pods = await prisma.pod.findMany({
    where: { isActive: true, mennyuOrdersPaused: false },
    select: {
      id: true,
      vendors: {
        where: { isActive: true },
        select: {
          vendor: {
            select: { isActive: true, mennyuOrdersPaused: true },
          },
        },
      },
    },
    take: 200,
  });

  let count = 0;
  for (const pod of pods) {
    const hasOrderable = pod.vendors.some(
      (pv) => pv.vendor.isActive && !pv.vendor.mennyuOrdersPaused
    );
    if (!hasOrderable) count++;
  }
  return count;
}

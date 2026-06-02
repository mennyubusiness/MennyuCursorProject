/**
 * POST /api/vendor/orders/[vendorOrderId]/status
 * Body: { targetState, vendorId }
 * Verifies the vendor order belongs to the vendor, then applies the same transition used by the dev simulator.
 * Updates customer order tracking and can trigger SMS when parent status changes.
 * When vendor denies (cancelled), runs refund decision and auto-refund for that vendor portion.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyVendorAccessForApi } from "@/lib/vendor-dashboard-auth";
import { applyVendorOrderTransition } from "@/services/order-status.service";
import { canVendorRejectVendorOrder } from "@/lib/cancel-eligibility";
import {
  canVendorDashboardMutateVendorOrder,
  VENDOR_DELIVERECT_CONTROLLED_MESSAGE,
} from "@/lib/deliverect-vendor-order-authority";
import { isRoutingRetryAvailable } from "@/lib/routing-availability";
import { isDeliverectVendorOrderRoutingDegraded } from "@/lib/vendor-deliverect-dashboard-visibility";
import { getRefundDecision } from "@/lib/refund-decision";
import { runAutomaticRefundForDecision } from "@/lib/refund-route-helpers";
import type { VendorOrderTargetState } from "@/domain/vendor-order-transition";

const VENDOR_DASHBOARD_SOURCE = "vendor_dashboard";

const ALLOWED_TARGETS: VendorOrderTargetState[] = [
  "confirmed", // sent → confirmed (vendor acknowledges receipt)
  "accepted",
  "preparing",
  "ready",
  "completed",
  "cancelled",
];

export async function POST(
  request: Request,
  context: { params: Promise<{ vendorOrderId: string }> }
) {
  const { vendorOrderId } = await context.params;
  if (!vendorOrderId) {
    return NextResponse.json({ error: "Missing vendorOrderId" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const vendorId = typeof obj?.vendorId === "string" ? obj.vendorId : null;
  const targetState = typeof obj?.targetState === "string" ? obj.targetState : null;

  if (!vendorId || !targetState) {
    return NextResponse.json(
      { error: "Missing or invalid vendorId or targetState" },
      { status: 400 }
    );
  }

  if (!ALLOWED_TARGETS.includes(targetState as VendorOrderTargetState)) {
    return NextResponse.json(
      {
        error: `Invalid targetState. Allowed for vendor dashboard: ${ALLOWED_TARGETS.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const vo = await prisma.vendorOrder.findUnique({
    where: { id: vendorOrderId },
    select: {
      vendorId: true,
      routingStatus: true,
      fulfillmentStatus: true,
      manuallyRecoveredAt: true,
      statusAuthority: true,
      lastStatusSource: true,
      deliverectChannelLinkId: true,
      deliverectAttempts: true,
      order: { select: { updatedAt: true } },
      statusHistory: { select: { source: true } },
      vendor: {
        select: {
          vendorDashboardToken: true,
          deliverectChannelLinkId: true,
        },
      },
    },
  });
  if (!vo) {
    return NextResponse.json({ error: "Vendor order not found" }, { status: 404 });
  }

  const access = await verifyVendorAccessForApi(
    vo.vendorId,
    request,
    vo.vendor.vendorDashboardToken
  );
  if (!access.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (vendorId !== vo.vendorId) {
    return NextResponse.json({ error: "Vendor order does not belong to this vendor" }, { status: 403 });
  }

  const authorityVo = {
    statusAuthority: vo.statusAuthority,
    lastStatusSource: vo.lastStatusSource,
    deliverectChannelLinkId: vo.deliverectChannelLinkId,
    vendor: vo.vendor,
    routingStatus: vo.routingStatus,
    manuallyRecoveredAt: vo.manuallyRecoveredAt,
  };

  if (!canVendorDashboardMutateVendorOrder(authorityVo)) {
    const isDeliverectLive = isRoutingRetryAvailable();
    const routingDegraded = isDeliverectVendorOrderRoutingDegraded(
      vo,
      vo.vendor,
      isDeliverectLive,
      Date.now()
    );
    const allowDegradedConfirmOnly =
      routingDegraded &&
      targetState === "confirmed" &&
      vo.routingStatus === "pending" &&
      vo.fulfillmentStatus === "pending";

    if (!allowDegradedConfirmOnly) {
      return NextResponse.json(
        {
          ok: false,
          error: VENDOR_DELIVERECT_CONTROLLED_MESSAGE,
          code: "POS_MANAGED_USE_FALLBACK",
          precedenceReason: "POS_MANAGED_USE_FALLBACK",
        },
        { status: 409 }
      );
    }
  }

  if (targetState === "cancelled" && !canVendorRejectVendorOrder({ ...authorityVo, fulfillmentStatus: vo.fulfillmentStatus, statusHistory: vo.statusHistory })) {
    return NextResponse.json(
      {
        error:
          "This order can no longer be denied. Only orders that are not yet preparing can be rejected.",
        code: "NOT_ELIGIBLE",
      },
      { status: 400 }
    );
  }

  try {
    const result = await applyVendorOrderTransition(
      vendorOrderId,
      targetState as VendorOrderTargetState,
      VENDOR_DASHBOARD_SOURCE
    );

    if (!result.success && result.precedenceReason) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          code: result.code ?? result.precedenceReason,
          precedenceReason: result.precedenceReason,
        },
        { status: 409 }
      );
    }

    if (result.success) {
      let refundPayload: {
        refund?: {
          success: boolean;
          code?: string;
          message?: string;
          amountCents?: number;
          requiresAdminReview?: boolean;
        };
      } = {};
      if (targetState === "cancelled" && result.orderId) {
        const orderForRefund = await prisma.order.findUnique({
          where: { id: result.orderId },
          select: {
            id: true,
            status: true,
            totalCents: true,
            vendorOrders: {
              select: { id: true, totalCents: true, routingStatus: true, fulfillmentStatus: true },
            },
          },
        });
        if (orderForRefund) {
          const decision = getRefundDecision({
            orderId: orderForRefund.id,
            trigger: "vendor_denial",
            vendorOrderId,
            order: orderForRefund,
          });
          if (decision.required) {
            const apiRefund = await runAutomaticRefundForDecision(decision, {
              customerVisibleNote: "This vendor could not fulfill your order — refund processing.",
            });
            if (apiRefund) {
              refundPayload = { refund: apiRefund };
            }
          }
        }
      }
      return NextResponse.json({ ...result, ...refundPayload });
    }

    if (result.code === "NOT_FOUND") {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: 400 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

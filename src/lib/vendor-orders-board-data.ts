import { cache } from "react";
import { prisma } from "@/lib/db";
import { isRoutingRetryAvailable } from "@/lib/routing-availability";
import {
  isDeliverectVendorOrderRoutingDegraded,
  shouldOmitVendorOrderFromDeliverectDashboard,
} from "@/lib/vendor-deliverect-dashboard-visibility";

/** Shared vendor + orders payload for Orders hub and Kitchen Mode. */
export const getVendorOrdersBoardData = cache(async (vendorId: string) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      id: true,
      name: true,
      mennyuOrdersPaused: true,
      deliverectChannelLinkId: true,
      deliverectLocationId: true,
      posConnectionStatus: true,
      orderRoutingMode: true,
      pendingDeliverectConnectionKey: true,
      deliverectAutoMapLastOutcome: true,
      deliverectAutoMapLastAt: true,
      stripeConnectedAccountId: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
    },
  });
  if (!vendor) return null;

  const vendorOrders = await prisma.vendorOrder.findMany({
    where: {
      vendorId,
      order: { status: { not: "pending_payment" } },
    },
    select: {
      id: true,
      orderId: true,
      routingStatus: true,
      fulfillmentStatus: true,
      manuallyRecoveredAt: true,
      totalCents: true,
      tipCents: true,
      totalRefundedCents: true,
      order: {
        select: {
          id: true,
          orderNotes: true,
          customerPhone: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { vendorOrders: true } },
        },
      },
      deliverectAttempts: true,
      deliverectChannelLinkId: true,
      statusAuthority: true,
      lastExternalStatus: true,
      lastExternalStatusAt: true,
      lineItems: {
        select: {
          id: true,
          name: true,
          quantity: true,
          priceCents: true,
          specialInstructions: true,
          selections: {
            select: {
              nameSnapshot: true,
              quantity: true,
              modifierOption: { select: { name: true } },
            },
          },
        },
      },
      statusHistory: {
        orderBy: { createdAt: "asc" },
        select: { source: true, fulfillmentStatus: true, routingStatus: true, createdAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return { vendor, vendorOrders };
});

export type VendorOrderForBoardClient = ReturnType<typeof serializeVendorOrdersForBoard>[number];

export function serializeVendorOrdersForBoard(
  vendorOrders: NonNullable<Awaited<ReturnType<typeof getVendorOrdersBoardData>>>["vendorOrders"],
  vendor: NonNullable<Awaited<ReturnType<typeof getVendorOrdersBoardData>>>["vendor"],
  nowMs: number
) {
  const isDeliverectLive = isRoutingRetryAvailable();
  const visible = vendorOrders.filter(
    (vo) => !shouldOmitVendorOrderFromDeliverectDashboard(vo, vendor, isDeliverectLive, nowMs)
  );

  return visible.map((vo) => ({
    ...vo,
    manuallyRecoveredAt: vo.manuallyRecoveredAt?.toISOString() ?? null,
    lastExternalStatusAt: vo.lastExternalStatusAt?.toISOString() ?? null,
    order: {
      ...vo.order,
      createdAt: vo.order.createdAt.toISOString(),
    },
    statusHistory: vo.statusHistory.map((h) => ({
      ...h,
      createdAt: h.createdAt.toISOString(),
    })),
    deliverectRoutingDegraded: isDeliverectVendorOrderRoutingDegraded(
      vo,
      vendor,
      isDeliverectLive,
      nowMs
    ),
  }));
}

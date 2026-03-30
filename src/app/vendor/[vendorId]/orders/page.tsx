import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { isRoutingRetryAvailable } from "@/lib/routing-availability";
import {
  isDeliverectVendorOrderRoutingDegraded,
  shouldOmitVendorOrderFromDeliverectDashboard,
} from "@/lib/vendor-deliverect-dashboard-visibility";
import { VendorOrdersOperationsBar } from "../dashboard/VendorOrdersOperationsBar";
import { VendorDashboardLiveOrders } from "../dashboard/VendorDashboardLiveOrders";

const getVendorOrdersPageData = cache(async (vendorId: string) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      id: true,
      name: true,
      mennyuOrdersPaused: true,
      deliverectChannelLinkId: true,
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
      statusHistory: { orderBy: { createdAt: "asc" }, select: { source: true, fulfillmentStatus: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return { vendor, vendorOrders };
});

export default async function VendorOrdersPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;

  const data = await getVendorOrdersPageData(vendorId);
  if (!data) notFound();
  const { vendor, vendorOrders } = data;
  const isDeliverectLive = isRoutingRetryAvailable();

  const initialNowMs = Date.now();
  const visibleVendorOrders = vendorOrders.filter(
    (vo) =>
      !shouldOmitVendorOrderFromDeliverectDashboard(vo, vendor, isDeliverectLive, initialNowMs)
  );

  const initialVendorOrdersForClient = visibleVendorOrders.map((vo) => ({
    ...vo,
    manuallyRecoveredAt: vo.manuallyRecoveredAt?.toISOString() ?? null,
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
      initialNowMs
    ),
  }));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-stone-900">Orders</h2>
        <p className="mt-1 text-sm text-stone-600">
          Your live queue — one status and one action area per order below.
        </p>
      </div>

      <VendorOrdersOperationsBar
        vendorId={vendor.id}
        initialPaused={vendor.mennyuOrdersPaused ?? false}
        posOpen={undefined}
      />

      <VendorDashboardLiveOrders
        vendorId={vendor.id}
        initialVendorOrders={initialVendorOrdersForClient}
        initialNowMs={initialNowMs}
        isDeliverectLive={isDeliverectLive}
      />
    </div>
  );
}

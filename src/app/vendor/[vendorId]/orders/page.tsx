import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { isRoutingRetryAvailable } from "@/lib/routing-availability";
import {
  isDeliverectVendorOrderRoutingDegraded,
  shouldOmitVendorOrderFromDeliverectDashboard,
} from "@/lib/vendor-deliverect-dashboard-visibility";
import { hasUnmatchedChannelRegistrationForVendorById } from "@/services/deliverect-channel-registration-retry.service";
import { VendorPosConnectionPanel } from "@/components/vendor/VendorPosConnectionPanel";
import { VendorOnboardingProgress } from "../dashboard/VendorOnboardingProgress";
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
      deliverectLocationId: true,
      posConnectionStatus: true,
      pendingDeliverectConnectionKey: true,
      deliverectAutoMapLastOutcome: true,
      deliverectAutoMapLastAt: true,
    },
  });
  if (!vendor) return null;
  const hasUnmatchedChannelRegistration = await hasUnmatchedChannelRegistrationForVendorById(vendorId);
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
  return { vendor, vendorOrders, hasUnmatchedChannelRegistration };
});

export default async function VendorOrdersPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;

  const data = await getVendorOrdersPageData(vendorId);
  if (!data) notFound();
  const { vendor, vendorOrders, hasUnmatchedChannelRegistration } = data;
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
      <div className="border-b border-stone-200/80 pb-6">
        <h2 className="text-2xl font-bold tracking-tight text-stone-900">Orders</h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-stone-600">
          Your live queue — newest actions at the top of each section. One primary action per order.
        </p>
      </div>

      <VendorOnboardingProgress
        vendorId={vendor.id}
        posConnectionStatus={vendor.posConnectionStatus}
        deliverectChannelLinkId={vendor.deliverectChannelLinkId}
        pendingDeliverectConnectionKey={vendor.pendingDeliverectConnectionKey}
        deliverectAutoMapLastOutcome={vendor.deliverectAutoMapLastOutcome}
        hasUnmatchedChannelRegistration={hasUnmatchedChannelRegistration}
      />

      <VendorPosConnectionPanel
        vendorId={vendor.id}
        vendorName={vendor.name}
        deliverectChannelLinkId={vendor.deliverectChannelLinkId}
        deliverectLocationId={vendor.deliverectLocationId}
        posConnectionStatus={vendor.posConnectionStatus}
        pendingDeliverectConnectionKey={vendor.pendingDeliverectConnectionKey}
        deliverectAutoMapLastOutcome={vendor.deliverectAutoMapLastOutcome}
        deliverectAutoMapLastAt={vendor.deliverectAutoMapLastAt}
        hasUnmatchedChannelRegistration={hasUnmatchedChannelRegistration}
      />

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

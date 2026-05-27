import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { isRoutingRetryAvailable } from "@/lib/routing-availability";
import {
  isDeliverectVendorOrderRoutingDegraded,
  shouldOmitVendorOrderFromDeliverectDashboard,
} from "@/lib/vendor-deliverect-dashboard-visibility";
import { deriveVendorPosUiState } from "@/lib/vendor-pos-ui-state";
import { hasUnmatchedChannelRegistrationForVendorById } from "@/services/deliverect-channel-registration-retry.service";
import { VendorOrdersOperationsBar } from "../dashboard/VendorOrdersOperationsBar";
import { VendorDashboardLiveOrders } from "../dashboard/VendorDashboardLiveOrders";
import { VendorOrdersSetupBanner } from "../dashboard/VendorOrdersSetupBanner";
import { VendorOrdersSystemStatusStrip } from "../dashboard/VendorOrdersSystemStatusStrip";

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
      stripeConnectedAccountId: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
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

  const posUi = deriveVendorPosUiState({
    deliverectChannelLinkId: vendor.deliverectChannelLinkId,
    posConnectionStatus: vendor.posConnectionStatus,
    deliverectAutoMapLastOutcome: vendor.deliverectAutoMapLastOutcome,
    pendingDeliverectConnectionKey: vendor.pendingDeliverectConnectionKey,
    hasUnmatchedChannelRegistrationForVendor: hasUnmatchedChannelRegistration,
  });
  const posConnected = posUi === "connected";
  const posSyncLine = posConnected
    ? "POS connected — orders auto-syncing"
    : "Manual mode — orders require confirmation";

  const payoutsReady = Boolean(
    vendor.stripeConnectedAccountId?.trim() &&
      vendor.stripeChargesEnabled &&
      vendor.stripePayoutsEnabled
  );

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

  const setupBannerVisible = !posConnected || !payoutsReady;

  return (
    <div className="space-y-8 pb-8">
      <header className="flex flex-col gap-4 border-b border-oo-light-stone/70 pb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-oo-charcoal">Orders</h1>
          <p className="mt-1 text-sm text-oo-stone-gray">Live queue — newest actions first</p>
          <p className="mt-3 text-sm text-oo-stone-gray">{posSyncLine}</p>
        </div>
        <VendorOrdersSystemStatusStrip
          vendorId={vendor.id}
          posConnected={posConnected}
          payoutsReady={payoutsReady}
          ordersPaused={vendor.mennyuOrdersPaused ?? false}
        />
      </header>

      <VendorOrdersSetupBanner vendorId={vendor.id} show={setupBannerVisible} />

      <VendorOrdersOperationsBar
        vendorId={vendor.id}
        initialPaused={vendor.mennyuOrdersPaused ?? false}
        posOpen={undefined}
        layout="compact"
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

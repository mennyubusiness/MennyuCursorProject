import Link from "next/link";
import { notFound } from "next/navigation";
import { isRoutingRetryAvailable } from "@/lib/routing-availability";
import { deriveVendorPosUiState } from "@/lib/vendor-pos-ui-state";
import { hasUnmatchedChannelRegistrationForVendorById } from "@/services/deliverect-channel-registration-retry.service";
import {
  getVendorOrdersBoardData,
  serializeVendorOrdersForBoard,
} from "@/lib/vendor-orders-board-data";
import { VendorOrdersOperationsBar } from "../dashboard/VendorOrdersOperationsBar";
import { VendorDashboardLiveOrders } from "../dashboard/VendorDashboardLiveOrders";
import { VendorOrdersSetupBanner } from "../dashboard/VendorOrdersSetupBanner";
import { VendorOrdersSystemStatusStrip } from "../dashboard/VendorOrdersSystemStatusStrip";

export default async function VendorOrdersPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;

  const data = await getVendorOrdersBoardData(vendorId);
  if (!data) notFound();
  const { vendor, vendorOrders } = data;
  const isDeliverectLive = isRoutingRetryAvailable();

  const hasUnmatchedChannelRegistration = await hasUnmatchedChannelRegistrationForVendorById(
    vendorId
  );

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
  const initialVendorOrdersForClient = serializeVendorOrdersForBoard(
    vendorOrders,
    vendor,
    initialNowMs
  );

  const setupBannerVisible = !posConnected || !payoutsReady;

  return (
    <div className="space-y-8 pb-8">
      <header className="flex flex-col gap-4 border-b border-oo-light-stone/70 pb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-oo-charcoal">Orders</h1>
          <p className="mt-1 text-sm text-oo-stone-gray">Live queue — newest actions first</p>
          <p className="mt-3 text-sm text-oo-stone-gray">{posSyncLine}</p>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-3 sm:items-end">
          <Link
            href={`/vendor/${vendor.id}/kitchen`}
            className="inline-flex items-center justify-center rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-hover"
          >
            Kitchen Mode
          </Link>
          <VendorOrdersSystemStatusStrip
            vendorId={vendor.id}
            posConnected={posConnected}
            payoutsReady={payoutsReady}
            ordersPaused={vendor.mennyuOrdersPaused ?? false}
          />
        </div>
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
        vendorDeliverectChannelLinkId={vendor.deliverectChannelLinkId}
        initialVendorOrders={initialVendorOrdersForClient}
        initialNowMs={initialNowMs}
        isDeliverectLive={isDeliverectLive}
      />
    </div>
  );
}

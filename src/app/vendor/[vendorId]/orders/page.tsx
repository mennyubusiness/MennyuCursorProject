import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DashboardCard,
  DashboardPageHeader,
  DashboardSection,
  DashboardShell,
} from "@/components/dashboard";
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
    : "Manual mode — confirm orders in Open Order when needed";

  const paymentsReady = Boolean(
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

  const setupBannerVisible = !posConnected || !paymentsReady;

  return (
    <DashboardShell tier="command" className="px-0 pb-0 pt-0">
      <DashboardPageHeader
        headingLevel={1}
        eyebrow={vendor.name}
        title="Orders"
        description="Manage incoming orders, kitchen status, and customer pickup flow."
        actions={
          <Link
            href={`/vendor/${vendor.id}/kitchen`}
            className="inline-flex items-center justify-center rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-hover"
          >
            Kitchen Mode
          </Link>
        }
      />

      <div className="mt-8 space-y-6">
        <VendorOrdersSetupBanner vendorId={vendor.id} show={setupBannerVisible} />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,360px)]">
          <DashboardSection
            title="Live orders"
            description="Newest actions first — accept, prepare, and mark ready from here."
            className="min-w-0"
            contentClassName="space-y-0"
          >
            <VendorDashboardLiveOrders
              vendorId={vendor.id}
              vendorDeliverectChannelLinkId={vendor.deliverectChannelLinkId}
              initialVendorOrders={initialVendorOrdersForClient}
              initialNowMs={initialNowMs}
              isDeliverectLive={isDeliverectLive}
            />
          </DashboardSection>

          <div className="flex min-w-0 flex-col gap-6">
            <DashboardCard title="System status" description={posSyncLine}>
              <VendorOrdersSystemStatusStrip
                vendorId={vendor.id}
                posConnected={posConnected}
                paymentsReady={paymentsReady}
                ordersPaused={vendor.mennyuOrdersPaused ?? false}
              />
            </DashboardCard>

            <DashboardCard title="Order intake">
              <VendorOrdersOperationsBar
                vendorId={vendor.id}
                initialPaused={vendor.mennyuOrdersPaused ?? false}
                posOpen={undefined}
                layout="compact"
              />
            </DashboardCard>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

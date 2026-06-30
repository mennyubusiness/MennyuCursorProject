import { notFound } from "next/navigation";
import { isRoutingRetryAvailable } from "@/lib/routing-availability";
import {
  isVendorDeliverectLiveForUi,
  vendorKitchenStatusLine,
  vendorKitchenStatusWarning,
} from "@/lib/vendor-order-routing-mode";
import { deriveVendorPosUiState } from "@/lib/vendor-pos-ui-state";
import { hasUnmatchedChannelRegistrationForVendorById } from "@/services/deliverect-channel-registration-retry.service";
import {
  getVendorOrdersBoardData,
  serializeVendorOrdersForBoard,
} from "@/lib/vendor-orders-board-data";
import { VendorKitchenBoard } from "./VendorKitchenBoard";

export default async function VendorKitchenPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  const data = await getVendorOrdersBoardData(vendorId);
  if (!data) notFound();

  const { vendor } = data;
  const initialNowMs = Date.now();
  const isDeliverectLive = isVendorDeliverectLiveForUi(
    vendor.orderRoutingMode,
    isRoutingRetryAvailable()
  );
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

  const posStatusLine = vendorKitchenStatusLine(vendor.orderRoutingMode, posUi);
  const posWarning = vendorKitchenStatusWarning(vendor.orderRoutingMode, posUi);

  const initialVendorOrders = serializeVendorOrdersForBoard(
    data.vendorOrders,
    vendor,
    initialNowMs
  );

  return (
    <VendorKitchenBoard
      vendorId={vendor.id}
      vendorName={vendor.name}
      initialVendorOrders={initialVendorOrders}
      initialNowMs={initialNowMs}
      isDeliverectLive={isDeliverectLive}
      orderRoutingMode={vendor.orderRoutingMode}
      vendorDeliverectChannelLinkId={vendor.deliverectChannelLinkId}
      ordersPaused={vendor.mennyuOrdersPaused ?? false}
      posStatusLine={posStatusLine}
      posWarning={posWarning}
    />
  );
}

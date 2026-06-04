import { notFound } from "next/navigation";
import { isRoutingRetryAvailable } from "@/lib/routing-availability";
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

  const posStatusLine =
    posUi === "connected"
      ? "POS connected — status may sync from kitchen system"
      : posUi === "needs_attention"
        ? "POS needs attention — confirm orders in Open Order if needed"
        : "Manual mode — use buttons below to update order status";

  const posWarning =
    posUi === "needs_attention"
      ? "POS connection needs attention. Orders may not sync automatically until this is resolved."
      : posUi === "not_connected"
        ? "POS not connected — kitchen actions update Open Order directly."
        : null;

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
      vendorDeliverectChannelLinkId={vendor.deliverectChannelLinkId}
      ordersPaused={vendor.mennyuOrdersPaused ?? false}
      posStatusLine={posStatusLine}
      posWarning={posWarning}
    />
  );
}

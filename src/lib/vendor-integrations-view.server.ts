import "server-only";

import { getVendorIntegrationObservability } from "@/lib/integrations/provider-observability.service";
import { loadSquareOrderRoutingReadiness } from "@/lib/integrations/square/square-order-routing-readiness";
import { loadVendorDashboardContext } from "@/lib/vendor-dashboard-data.server";
import { isDeliverectRoutingMode } from "@/lib/vendor-order-routing-mode";
import {
  buildVendorSetupIntegrationsView,
  inactiveDeliverectConnectionHealth,
  type VendorIntegrationsSurface,
  type VendorSetupIntegrationsViewModel,
} from "@/lib/vendor-setup-integrations";

export async function loadVendorIntegrationsViewModel(
  vendorId: string,
  surface: VendorIntegrationsSurface
): Promise<{
  model: VendorSetupIntegrationsViewModel | null;
  orderRoutingMode: string;
} | null> {
  const ctx = await loadVendorDashboardContext(vendorId);
  if (!ctx) return null;

  const integrationObservability = await getVendorIntegrationObservability(vendorId);
  const squareReadiness = integrationObservability
    ? await loadSquareOrderRoutingReadiness(vendorId)
    : null;

  const model =
    integrationObservability &&
    buildVendorSetupIntegrationsView({
      vendorId,
      orderRoutingMode: ctx.vendorRecord.orderRoutingMode,
      menuSource: ctx.vendorRecord.menuSource,
      readiness: integrationObservability.readiness,
      menuReadiness: {
        menuSource: ctx.vendorRecord.menuSource,
        orderRoutingMode: ctx.vendorRecord.orderRoutingMode,
        hasPublishedMenuVersion: Boolean(ctx.menuSummary.hasPublishedMenuVersion),
        hasOperationalItems: Boolean(ctx.menuSummary.hasOperationalItems),
        hasSquarePublishedMenu: squareReadiness?.hasSquarePublishedMenu,
      },
      squareHealth: integrationObservability.squareHealth,
      deliverectRoutingHealth: isDeliverectRoutingMode(ctx.vendorRecord.orderRoutingMode)
        ? integrationObservability.readiness.orderRouting?.health ?? null
        : inactiveDeliverectConnectionHealth({
            posConnectionStatus: ctx.readinessPosSummary.posConnectionStatus,
            deliverectChannelLinkId: ctx.readinessPosSummary.deliverectChannelLinkId,
          }),
      surface,
    });

  return {
    model,
    orderRoutingMode: ctx.vendorRecord.orderRoutingMode,
  };
}

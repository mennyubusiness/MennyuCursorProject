import "server-only";

import type { IntegrationProvider, ProviderConnectionHealth, ProviderMappingHealth } from "@/lib/integrations/types";
import { getMenuProviderAdapter, getOrderProviderAdapter } from "@/lib/integrations/provider-registry";
import { countActiveMappingsForVendor } from "@/lib/integrations/provider-mapping.service";
import { providerDisplayLabel } from "@/lib/integrations/provider-capabilities";
import { isDeliverectRoutingMode } from "@/lib/vendor-order-routing-mode";
import { isDeliverectMenuSource, isOpenOrderMenuSource } from "@/lib/vendor-menu-source";
import { prisma } from "@/lib/db";

export type VendorOrderProviderReadiness = {
  activeProvider: IntegrationProvider;
  health: ProviderConnectionHealth;
};

export type VendorMenuProviderReadiness = {
  activeProvider: IntegrationProvider;
  health: ProviderConnectionHealth;
};

function orderProviderForVendor(orderRoutingMode: string): IntegrationProvider {
  return isDeliverectRoutingMode(orderRoutingMode) ? "deliverect" : "manual_dashboard";
}

function menuProviderForVendor(menuSource: string): IntegrationProvider {
  return isDeliverectMenuSource({ menuSource: menuSource as "open_order" | "deliverect" })
    ? "deliverect"
    : "open_order";
}

export async function getVendorOrderProviderReadiness(
  vendorId: string
): Promise<VendorOrderProviderReadiness | null> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { orderRoutingMode: true, deletedAt: true },
  });
  if (!vendor || vendor.deletedAt) return null;

  const activeProvider = orderProviderForVendor(vendor.orderRoutingMode);
  const adapter = getOrderProviderAdapter(activeProvider);
  if (!adapter) {
    return {
      activeProvider,
      health: {
        provider: activeProvider,
        status: "error",
        isReady: false,
        missingRequirements: [`No order adapter registered for ${activeProvider}`],
        warnings: [],
        lastCheckedAt: new Date(),
      },
    };
  }

  const health = await adapter.validateConnection({ vendorId });
  return { activeProvider, health };
}

export async function getVendorMenuProviderReadiness(
  vendorId: string
): Promise<VendorMenuProviderReadiness | null> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { menuSource: true, deletedAt: true },
  });
  if (!vendor || vendor.deletedAt) return null;

  const activeProvider = menuProviderForVendor(vendor.menuSource);
  const adapter = getMenuProviderAdapter(activeProvider);
  if (!adapter) {
    return {
      activeProvider,
      health: {
        provider: activeProvider,
        status: "error",
        isReady: false,
        missingRequirements: [`No menu adapter registered for ${activeProvider}`],
        warnings: [],
        lastCheckedAt: new Date(),
      },
    };
  }

  const health = await adapter.validateConnection({ vendorId });
  return { activeProvider, health };
}

export async function getProviderMappingHealth(
  vendorId: string,
  provider: IntegrationProvider
): Promise<ProviderMappingHealth> {
  const notes: string[] = [];
  let missingRequiredMappings = 0;

  const activeMappings = await countActiveMappingsForVendor({ vendorId, provider });

  if (provider === "deliverect") {
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { orderRoutingMode: true, menuSource: true },
    });
    if (
      vendor &&
      (isDeliverectRoutingMode(vendor.orderRoutingMode) || isDeliverectMenuSource(vendor))
    ) {
      try {
        const { evaluateDeliverectMenuIntegrityForVendor } = await import(
          "@/services/deliverect-menu-integrity.service"
        );
        const report = await evaluateDeliverectMenuIntegrityForVendor(vendorId);
        if (!report.deliverectReady) {
          missingRequiredMappings = report.criticalCount;
          notes.push(
            `Deliverect legacy mapping integrity: ${report.criticalCount} critical findings`
          );
        }
      } catch (e) {
        notes.push(e instanceof Error ? e.message : String(e));
        missingRequiredMappings = 1;
      }
    }
    notes.push("Deliverect product/modifier IDs on MenuItem/ModifierOption remain source of truth");
  } else if (provider === "open_order") {
    notes.push("Open Order menu builder uses internal IDs; normalized mappings optional");
  } else if (provider === "square") {
    notes.push("Square mappings will use ProviderEntityMapping when catalog sync is implemented");
  }

  return {
    provider,
    totalMappings: activeMappings,
    activeMappings,
    missingRequiredMappings,
    isHealthy: missingRequiredMappings === 0,
    notes,
  };
}

export type VendorIntegrationReadinessSummary = {
  orderRouting: VendorOrderProviderReadiness | null;
  menuSource: VendorMenuProviderReadiness | null;
  labels: {
    orderRouting: string;
    menuSource: string;
  };
};

export async function getVendorIntegrationReadinessSummary(
  vendorId: string
): Promise<VendorIntegrationReadinessSummary> {
  const [orderRouting, menuSource] = await Promise.all([
    getVendorOrderProviderReadiness(vendorId),
    getVendorMenuProviderReadiness(vendorId),
  ]);

  return {
    orderRouting,
    menuSource,
    labels: {
      orderRouting: orderRouting
        ? `Order routing: ${providerDisplayLabel(orderRouting.activeProvider)}`
        : "Order routing: unknown",
      menuSource: menuSource
        ? `Menu source: ${providerDisplayLabel(menuSource.activeProvider)}`
        : "Menu source: unknown",
    },
  };
}

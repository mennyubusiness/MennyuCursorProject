import type { MenuProviderAdapter, OrderProviderAdapter } from "@/lib/integrations/adapters/types";
import { deliverectMenuAdapter, deliverectOrderAdapter } from "@/lib/integrations/adapters/deliverect.adapter";
import { manualDashboardOrderAdapter } from "@/lib/integrations/adapters/manual-dashboard-order.adapter";
import { openOrderMenuAdapter } from "@/lib/integrations/adapters/open-order-menu.adapter";
import {
  squareMenuAdapter,
  squareOrderAdapter,
} from "@/lib/integrations/adapters/square.adapter";
import {
  assertProviderSupportsCapability,
  getProviderCapabilities,
  providerSupportsCapability,
} from "@/lib/integrations/provider-capabilities";
import type { IntegrationCapability, IntegrationProvider } from "@/lib/integrations/types";
import { isIntegrationProvider } from "@/lib/integrations/types";

const ORDER_ADAPTERS: Partial<Record<IntegrationProvider, OrderProviderAdapter>> = {
  manual_dashboard: manualDashboardOrderAdapter,
  deliverect: deliverectOrderAdapter,
  square: squareOrderAdapter,
};

const MENU_ADAPTERS: Partial<Record<IntegrationProvider, MenuProviderAdapter>> = {
  open_order: openOrderMenuAdapter,
  deliverect: deliverectMenuAdapter,
  square: squareMenuAdapter,
};

export function getOrderProviderAdapter(provider: IntegrationProvider): OrderProviderAdapter | null {
  return ORDER_ADAPTERS[provider] ?? null;
}

export function getMenuProviderAdapter(provider: IntegrationProvider): MenuProviderAdapter | null {
  return MENU_ADAPTERS[provider] ?? null;
}

export function getProviderCapabilitiesForProvider(
  provider: IntegrationProvider
): IntegrationCapability[] {
  return getProviderCapabilities(provider);
}

export function assertProviderSupportsCapabilityOrThrow(
  provider: IntegrationProvider,
  capability: IntegrationCapability
): void {
  assertProviderSupportsCapability(provider, capability);
}

export function safeGetOrderProviderAdapter(provider: string): OrderProviderAdapter | null {
  if (!isIntegrationProvider(provider)) return null;
  return getOrderProviderAdapter(provider);
}

export function safeGetMenuProviderAdapter(provider: string): MenuProviderAdapter | null {
  if (!isIntegrationProvider(provider)) return null;
  return getMenuProviderAdapter(provider);
}

export function providerHasOrderAdapter(provider: IntegrationProvider): boolean {
  return Boolean(getOrderProviderAdapter(provider));
}

export function providerHasMenuAdapter(provider: IntegrationProvider): boolean {
  return Boolean(getMenuProviderAdapter(provider));
}

export { providerSupportsCapability };

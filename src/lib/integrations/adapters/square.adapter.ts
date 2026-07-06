import type { MenuProviderAdapter, OrderProviderAdapter } from "@/lib/integrations/adapters/types";
import type { ProviderConnectionHealth } from "@/lib/integrations/types";
import { getProviderCapabilities } from "@/lib/integrations/provider-capabilities";
import { evaluateSquareConnectionHealth } from "@/lib/integrations/square/square-connection.service";
import { getSquareConfigSnapshot } from "@/lib/integrations/square/square-config";

async function squareConnectionHealth(vendorId?: string): Promise<ProviderConnectionHealth> {
  const snap = getSquareConfigSnapshot();
  if (!snap.configured) {
    return {
      provider: "square",
      status: "not_configured",
      isReady: false,
      missingRequirements: ["Square OAuth is not configured on this deployment"],
      warnings: snap.partiallyConfigured
        ? ["Square environment variables are partially configured"]
        : [],
      lastCheckedAt: new Date(),
    };
  }

  if (!vendorId?.trim()) {
    return {
      provider: "square",
      status: "not_configured",
      isReady: false,
      missingRequirements: ["vendorId required"],
      warnings: [],
      lastCheckedAt: new Date(),
    };
  }

  return evaluateSquareConnectionHealth(vendorId.trim());
}

export const squareOrderAdapter: OrderProviderAdapter = {
  provider: "square",
  capabilities: getProviderCapabilities("square"),

  async validateConnection(input): Promise<ProviderConnectionHealth> {
    return squareConnectionHealth(input.vendorId);
  },

  async submitOrder() {
    return {
      success: false,
      errorCode: "NOT_IMPLEMENTED",
      errorMessage: "Square order injection is not implemented yet",
    };
  },

  async mapStatusWebhook() {
    return null;
  },
};

export const squareMenuAdapter: MenuProviderAdapter = {
  provider: "square",
  capabilities: getProviderCapabilities("square"),

  async validateConnection(input): Promise<ProviderConnectionHealth> {
    return squareConnectionHealth(input.vendorId);
  },

  async importMenu(_connectionId: string) {
    throw new Error("Square menu import is not implemented yet");
  },

  async validateMappings(vendorId: string): Promise<ProviderConnectionHealth> {
    return squareConnectionHealth(vendorId);
  },
};

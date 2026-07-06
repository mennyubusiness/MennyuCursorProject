import type { OrderProviderAdapter } from "@/lib/integrations/adapters/types";
import type { ProviderConnectionHealth } from "@/lib/integrations/types";
import { getProviderCapabilities } from "@/lib/integrations/provider-capabilities";
import { isManualDashboardRoutingMode } from "@/lib/vendor-order-routing-mode";
import { prisma } from "@/lib/db";

export const manualDashboardOrderAdapter: OrderProviderAdapter = {
  provider: "manual_dashboard",
  capabilities: getProviderCapabilities("manual_dashboard"),

  async validateConnection(input): Promise<ProviderConnectionHealth> {
    const vendorId = input.vendorId?.trim();
    if (!vendorId) {
      return {
        provider: "manual_dashboard",
        status: "not_configured",
        isReady: false,
        missingRequirements: ["vendorId required"],
        warnings: [],
        lastCheckedAt: new Date(),
      };
    }

    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { orderRoutingMode: true, isActive: true, deletedAt: true },
    });

    if (!vendor || vendor.deletedAt) {
      return {
        provider: "manual_dashboard",
        status: "error",
        isReady: false,
        missingRequirements: ["Vendor not found"],
        warnings: [],
        lastCheckedAt: new Date(),
      };
    }

    const manualMode = isManualDashboardRoutingMode(vendor.orderRoutingMode);
    const missing: string[] = [];
    if (!manualMode) {
      missing.push("Vendor order routing is not set to manual dashboard");
    }
    if (!vendor.isActive) {
      missing.push("Vendor is inactive");
    }

    return {
      provider: "manual_dashboard",
      status: missing.length === 0 ? "connected" : "not_configured",
      isReady: missing.length === 0,
      missingRequirements: missing,
      warnings: [],
      lastCheckedAt: new Date(),
    };
  },

  async submitOrder() {
    return {
      success: true,
      skipped: true,
      providerStatus: "manual_dashboard",
      errorMessage: "Manual dashboard routing does not submit orders externally",
    };
  },

  async mapStatusWebhook() {
    return null;
  },
};

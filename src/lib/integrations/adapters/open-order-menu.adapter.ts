import type { MenuProviderAdapter } from "@/lib/integrations/adapters/types";
import type { NormalizedMenu, ProviderConnectionHealth } from "@/lib/integrations/types";
import { getProviderCapabilities } from "@/lib/integrations/provider-capabilities";
import { resolveActiveMenuSource } from "@/lib/vendor-menu-source";
import { loadActiveMenuVersionForVendor } from "@/lib/vendor-active-menu-version.server";
import { MenuVersionState } from "@prisma/client";
import { prisma } from "@/lib/db";

export const openOrderMenuAdapter: MenuProviderAdapter = {
  provider: "open_order",
  capabilities: getProviderCapabilities("open_order"),

  async validateConnection(input): Promise<ProviderConnectionHealth> {
    const vendorId = input.vendorId?.trim();
    if (!vendorId) {
      return {
        provider: "open_order",
        status: "not_configured",
        isReady: false,
        missingRequirements: ["vendorId required"],
        warnings: [],
        lastCheckedAt: new Date(),
      };
    }

    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { menuSource: true, orderRoutingMode: true, isActive: true, deletedAt: true },
    });

    if (!vendor || vendor.deletedAt) {
      return {
        provider: "open_order",
        status: "error",
        isReady: false,
        missingRequirements: ["Vendor not found"],
        warnings: [],
        lastCheckedAt: new Date(),
      };
    }

    const missing: string[] = [];
    const active = resolveActiveMenuSource(vendor);
    if (active.provider !== "open_order") {
      missing.push("Vendor active menu source is not Open Order menu builder");
    }

    const published = await loadActiveMenuVersionForVendor(vendorId, { provider: "open_order" });
    if (!published || published.state !== MenuVersionState.published) {
      missing.push("No published menu version");
    }

    return {
      provider: "open_order",
      status: missing.length === 0 ? "connected" : "pending",
      isReady: missing.length === 0,
      missingRequirements: missing,
      warnings: [],
      lastCheckedAt: new Date(),
    };
  },

  async importMenu(): Promise<NormalizedMenu> {
    throw new Error("Open Order menu builder does not support external menu import");
  },

  async validateMappings(vendorId: string): Promise<ProviderConnectionHealth> {
    return openOrderMenuAdapter.validateConnection({ vendorId });
  },
};

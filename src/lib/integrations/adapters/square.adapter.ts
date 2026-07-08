import type { MenuProviderAdapter, OrderProviderAdapter } from "@/lib/integrations/adapters/types";
import type { NormalizedMenu, ProviderConnectionHealth } from "@/lib/integrations/types";
import { getProviderCapabilities } from "@/lib/integrations/provider-capabilities";
import { evaluateSquareConnectionHealth } from "@/lib/integrations/square/square-connection.service";
import { getSquareConfigSnapshot } from "@/lib/integrations/square/square-config";
import { prisma } from "@/lib/db";
import { importSquareCatalog } from "@/lib/integrations/square/square-menu-import.service";
import { parseSquareExternalId } from "@/lib/integrations/square/square-menu-ids";
import type { MennyuCanonicalMenu } from "@/domain/menu-import/canonical.schema";

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

function canonicalMenuToNormalizedMenu(
  menu: MennyuCanonicalMenu,
  locationId: string,
  jobId: string
): NormalizedMenu {
  return {
    externalMenuId: locationId,
    categories: menu.categories.map((category) => ({
      externalCategoryId: parseSquareExternalId(category.deliverectId) ?? category.deliverectId,
      name: category.name,
      sortOrder: category.sortOrder,
    })),
    items: menu.products.map((product) => ({
      externalItemId: parseSquareExternalId(product.deliverectId) ?? product.deliverectId,
      name: product.name,
      description: product.description,
      priceCents: product.priceCents,
      isAvailable: product.isAvailable,
    })),
    modifierGroups: menu.modifierGroupDefinitions.map((group) => ({
      externalGroupId: parseSquareExternalId(group.deliverectId) ?? group.deliverectId,
      name: group.name,
      minSelections: group.minSelections,
      maxSelections: group.maxSelections,
      options: group.options.map((option) => ({
        externalOptionId: parseSquareExternalId(option.deliverectId) ?? option.deliverectId,
        name: option.name,
        priceCents: option.priceCents,
      })),
    })),
    providerMetadata: {
      sourcePayloadKind: menu.deliverect.sourcePayloadKind,
      menuImportJobId: jobId,
    },
  };
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

  async importMenu(connectionId: string) {
    const connection = await prisma.vendorIntegrationConnection.findUnique({
      where: { id: connectionId },
      select: { vendorId: true, provider: true },
    });
    if (!connection || connection.provider !== "square") {
      throw new Error("Square connection not found");
    }
    const report = await importSquareCatalog(connection.vendorId);
    if (!report.menu) {
      throw new Error("Square catalog import produced no menu");
    }
    return canonicalMenuToNormalizedMenu(report.menu, report.locationId, report.jobId);
  },

  async validateMappings(vendorId: string): Promise<ProviderConnectionHealth> {
    return squareConnectionHealth(vendorId);
  },
};

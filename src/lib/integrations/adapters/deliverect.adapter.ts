import type { VendorMenuSource, VendorOrderRoutingMode } from "@prisma/client";
import type { MenuProviderAdapter, OrderProviderAdapter } from "@/lib/integrations/adapters/types";
import type {
  NormalizedProviderOrder,
  NormalizedProviderOrderResult,
  NormalizedProviderOrderStatus,
  NormalizedProviderStatusUpdate,
  ProviderConnectionHealth,
} from "@/lib/integrations/types";
import { getProviderCapabilities } from "@/lib/integrations/provider-capabilities";
import { interpretDeliverectWebhookFlat } from "@/integrations/deliverect/deliverect-status-map";
import { hasUnmatchedChannelRegistrationForVendorById } from "@/services/deliverect-channel-registration-retry.service";
import {
  isDeliverectRoutingMode,
  isVendorDeliverectPosConnected,
  type VendorPosConnectionSummary,
} from "@/lib/vendor-order-routing-mode";
import { isDeliverectMenuSource } from "@/lib/vendor-menu-source";
import { prisma } from "@/lib/db";

function fulfillmentToNormalizedStatus(
  fulfillment: string
): NormalizedProviderOrderStatus {
  switch (fulfillment) {
    case "accepted":
      return "accepted";
    case "preparing":
      return "preparing";
    case "ready":
      return "ready";
    case "completed":
      return "completed";
    case "cancelled":
      return "cancelled";
    case "pending":
      return "accepted";
    default:
      return "unknown";
  }
}

async function loadVendorDeliverectSummary(vendorId: string): Promise<{
  vendor: VendorPosConnectionSummary & {
    orderRoutingMode: VendorOrderRoutingMode;
    menuSource: VendorMenuSource;
  };
  deliverectMappingReady: boolean | undefined;
}> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      deliverectChannelLinkId: true,
      deliverectLocationId: true,
      deliverectAccountId: true,
      posConnectionStatus: true,
      deliverectAutoMapLastOutcome: true,
      pendingDeliverectConnectionKey: true,
      orderRoutingMode: true,
      menuSource: true,
    },
  });
  if (!vendor) {
    throw new Error("Vendor not found");
  }

  const hasUnmatched = await hasUnmatchedChannelRegistrationForVendorById(vendorId);
  let deliverectMappingReady: boolean | undefined;
  if (
    isDeliverectRoutingMode(vendor.orderRoutingMode) ||
    isDeliverectMenuSource(vendor)
  ) {
    try {
      const { evaluateDeliverectMenuIntegrityForVendor } = await import(
        "@/services/deliverect-menu-integrity.service"
      );
      const report = await evaluateDeliverectMenuIntegrityForVendor(vendorId);
      deliverectMappingReady = report.deliverectReady;
    } catch {
      deliverectMappingReady = false;
    }
  }

  return {
    vendor: { ...vendor, hasUnmatchedChannelRegistration: hasUnmatched },
    deliverectMappingReady,
  };
}

async function validateDeliverectConnection(vendorId: string): Promise<ProviderConnectionHealth> {
  const missing: string[] = [];
  const warnings: string[] = [];

  try {
    const { vendor, deliverectMappingReady } = await loadVendorDeliverectSummary(vendorId);
    const usesDeliverect =
      isDeliverectRoutingMode(vendor.orderRoutingMode) || isDeliverectMenuSource(vendor);

    if (!usesDeliverect) {
      missing.push("Vendor is not configured for Deliverect routing or menu");
    }

    if (isDeliverectRoutingMode(vendor.orderRoutingMode)) {
      if (!isVendorDeliverectPosConnected(vendor)) {
        missing.push("Deliverect channel link not connected");
      }
      if (deliverectMappingReady === false) {
        missing.push("Deliverect menu mappings incomplete");
      }
    }

    if (isDeliverectMenuSource(vendor) && deliverectMappingReady === false) {
      missing.push("Deliverect menu mappings incomplete");
    }

    if (vendor.hasUnmatchedChannelRegistration) {
      warnings.push("Unmatched Deliverect channel registration pending review");
    }

    const status =
      missing.length === 0
        ? "connected"
        : usesDeliverect
          ? "pending"
          : "not_configured";

    return {
      provider: "deliverect",
      status,
      isReady: missing.length === 0,
      missingRequirements: missing,
      warnings,
      lastCheckedAt: new Date(),
    };
  } catch (e) {
    return {
      provider: "deliverect",
      status: "error",
      isReady: false,
      missingRequirements: [e instanceof Error ? e.message : String(e)],
      warnings: [],
      lastCheckedAt: new Date(),
    };
  }
}

export const deliverectOrderAdapter: OrderProviderAdapter = {
  provider: "deliverect",
  capabilities: getProviderCapabilities("deliverect"),

  async validateConnection(input): Promise<ProviderConnectionHealth> {
    const vendorId = input.vendorId?.trim();
    if (!vendorId) {
      return {
        provider: "deliverect",
        status: "not_configured",
        isReady: false,
        missingRequirements: ["vendorId required"],
        warnings: [],
        lastCheckedAt: new Date(),
      };
    }
    return validateDeliverectConnection(vendorId);
  },

  /**
   * Wraps existing Deliverect submission — behavior unchanged.
   * Caller must supply customer phone/email on the normalized order customer fields.
   */
  async submitOrder(input: NormalizedProviderOrder): Promise<NormalizedProviderOrderResult> {
    const { submitVendorOrderToDeliverect } = await import("@/services/deliverect.service");
    const result = await submitVendorOrderToDeliverect(
      input.vendorOrderId,
      input.customer.phone ?? "",
      input.customer.email ?? null
    );
    return {
      success: result.success,
      externalOrderId: result.deliverectOrderId,
      errorCode: result.code,
      errorMessage: result.error,
      skipped: result.skipped,
      providerStatus: result.success ? "submitted" : undefined,
    };
  },

  async mapStatusWebhook(context): Promise<NormalizedProviderStatusUpdate | null> {
    const flat =
      context.payload && typeof context.payload === "object" && !Array.isArray(context.payload)
        ? (context.payload as Record<string, unknown>)
        : null;
    if (!flat) return null;

    const interpretation = interpretDeliverectWebhookFlat(flat);
    if (interpretation.kind !== "mapped") return null;

    const externalOrderId = String(flat.orderId ?? flat._id ?? flat.id ?? "").trim() || "unknown";

    return {
      provider: "deliverect",
      externalOrderId,
      vendorOrderId: null,
      status: fulfillmentToNormalizedStatus(interpretation.fulfillmentStatus),
      occurredAt: new Date(),
      reason: interpretation.rawNumericCode != null ? `code:${interpretation.rawNumericCode}` : null,
      rawEventId: String(flat.eventId ?? flat.id ?? "").trim() || null,
    };
  },
};

export const deliverectMenuAdapter: MenuProviderAdapter = {
  provider: "deliverect",
  capabilities: getProviderCapabilities("deliverect"),

  async validateConnection(input): Promise<ProviderConnectionHealth> {
    const vendorId = input.vendorId?.trim();
    if (!vendorId) {
      return {
        provider: "deliverect",
        status: "not_configured",
        isReady: false,
        missingRequirements: ["vendorId required"],
        warnings: [],
        lastCheckedAt: new Date(),
      };
    }
    return validateDeliverectConnection(vendorId);
  },

  async importMenu(connectionId: string) {
    const connection = await prisma.vendorIntegrationConnection.findUnique({
      where: { id: connectionId },
      select: { vendorId: true, provider: true },
    });
    if (!connection || connection.provider !== "deliverect") {
      throw new Error("Deliverect connection not found");
    }
    throw new Error(
      "Use existing Deliverect menu import pipeline (/api/admin/vendors/.../menu-import/deliverect-pull) — not yet wrapped"
    );
  },

  async validateMappings(vendorId: string): Promise<ProviderConnectionHealth> {
    return validateDeliverectConnection(vendorId);
  },
};

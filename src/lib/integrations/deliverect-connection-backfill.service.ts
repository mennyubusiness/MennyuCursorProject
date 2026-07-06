import "server-only";

import type { IntegrationProvider } from "@/lib/integrations/types";
import { getProviderCapabilities } from "@/lib/integrations/provider-capabilities";
import { prisma } from "@/lib/db";
import { isDeliverectRoutingMode } from "@/lib/vendor-order-routing-mode";
import { isDeliverectMenuSource } from "@/lib/vendor-menu-source";

export type PrepareDeliverectConnectionResult =
  | { action: "skipped"; reason: string }
  | { action: "created"; connectionId: string }
  | { action: "updated"; connectionId: string };

/**
 * Safe, idempotent upsert of a Deliverect VendorIntegrationConnection from legacy Vendor fields.
 * Does NOT migrate menu mappings — Deliverect IDs on MenuItem/ModifierOption remain authoritative.
 *
 * Run manually per vendor or via admin script when ready; not invoked automatically on deploy.
 */
export async function prepareDeliverectConnectionFromVendor(
  vendorId: string
): Promise<PrepareDeliverectConnectionResult> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      id: true,
      name: true,
      orderRoutingMode: true,
      menuSource: true,
      deliverectChannelLinkId: true,
      deliverectLocationId: true,
      deliverectAccountId: true,
      posConnectionStatus: true,
      deletedAt: true,
    },
  });

  if (!vendor || vendor.deletedAt) {
    return { action: "skipped", reason: "vendor_not_found" };
  }

  const usesDeliverect =
    isDeliverectRoutingMode(vendor.orderRoutingMode) ||
    isDeliverectMenuSource(vendor);

  if (!usesDeliverect) {
    return { action: "skipped", reason: "vendor_not_deliverect" };
  }

  const capabilities = getProviderCapabilities("deliverect");
  const status =
    vendor.deliverectChannelLinkId?.trim() && vendor.posConnectionStatus === "connected"
      ? "connected"
      : vendor.deliverectChannelLinkId?.trim()
        ? "pending"
        : "not_configured";

  const existing = await prisma.vendorIntegrationConnection.findFirst({
    where: { vendorId, provider: "deliverect", isActive: true },
    select: { id: true },
  });

  const data = {
    vendorId,
    provider: "deliverect" as IntegrationProvider,
    status: status as "connected" | "pending" | "not_configured",
    displayName: `Deliverect — ${vendor.name}`,
    externalAccountId: vendor.deliverectAccountId,
    externalLocationId: vendor.deliverectLocationId,
    externalStoreId: vendor.deliverectChannelLinkId,
    capabilities,
    isActive: true,
    lastHealthCheckAt: new Date(),
  };

  if (existing) {
    await prisma.vendorIntegrationConnection.update({
      where: { id: existing.id },
      data,
    });
    return { action: "updated", connectionId: existing.id };
  }

  const created = await prisma.vendorIntegrationConnection.create({ data, select: { id: true } });
  return { action: "created", connectionId: created.id };
}

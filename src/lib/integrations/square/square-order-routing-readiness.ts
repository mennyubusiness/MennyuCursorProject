import "server-only";

import { MenuVersionState } from "@prisma/client";
import { mennyuCanonicalMenuSchema } from "@/domain/menu-import/canonical.schema";
import { prisma } from "@/lib/db";
import { loadActiveMenuVersionForVendor } from "@/lib/vendor-active-menu-version.server";
import { isSquareRoutingMode } from "@/lib/vendor-order-routing-mode";
import { evaluateSquareConnectionHealth, getActiveSquareConnectionForVendor } from "@/lib/integrations/square/square-connection.service";

export type SquareOrderRoutingReadiness = {
  ready: boolean;
  enabled: boolean;
  connectionHealthy: boolean;
  hasSquarePublishedMenu: boolean;
  locationId: string | null;
  missingRequirements: string[];
};

export async function loadSquareOrderRoutingReadiness(
  vendorId: string
): Promise<SquareOrderRoutingReadiness> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      orderRoutingMode: true,
      squareOrderRoutingEnabled: true,
    },
  });

  const missing: string[] = [];
  if (!vendor) {
    return {
      ready: false,
      enabled: false,
      connectionHealthy: false,
      hasSquarePublishedMenu: false,
      locationId: null,
      missingRequirements: ["Vendor not found"],
    };
  }

  if (!isSquareRoutingMode(vendor.orderRoutingMode)) {
    missing.push("Order routing mode is not Square.");
  }

  const enabled = vendor.squareOrderRoutingEnabled === true;
  if (!enabled) {
    missing.push("Square order routing is not enabled for this vendor.");
  }

  const [health, connection, activeMenu] = await Promise.all([
    evaluateSquareConnectionHealth(vendorId),
    getActiveSquareConnectionForVendor(vendorId),
    loadActiveMenuVersionForVendor(vendorId, "open_order"),
  ]);

  const connectionHealthy = health.isReady;
  if (!connectionHealthy) {
    missing.push(...health.missingRequirements);
  }

  const locationId = connection?.externalLocationId ?? null;
  if (!locationId?.trim()) {
    missing.push("Square location is not selected.");
  }

  let hasSquarePublishedMenu = false;
  if (activeMenu?.state === MenuVersionState.published && activeMenu.menu) {
    hasSquarePublishedMenu =
      activeMenu.menu.deliverect.sourcePayloadKind === "square_catalog_v1";
  } else {
    const published = await prisma.menuVersion.findFirst({
      where: { vendorId, state: MenuVersionState.published },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: { canonicalSnapshot: true },
    });
    const parsed = published
      ? mennyuCanonicalMenuSchema.safeParse(published.canonicalSnapshot)
      : null;
    hasSquarePublishedMenu =
      parsed?.success === true &&
      parsed.data.deliverect.sourcePayloadKind === "square_catalog_v1";
  }

  if (!hasSquarePublishedMenu) {
    missing.push("Published menu must be imported from Square before order routing.");
  }

  const ready =
    isSquareRoutingMode(vendor.orderRoutingMode) &&
    enabled &&
    connectionHealthy &&
    Boolean(locationId?.trim()) &&
    hasSquarePublishedMenu;

  return {
    ready,
    enabled,
    connectionHealthy,
    hasSquarePublishedMenu,
    locationId,
    missingRequirements: missing,
  };
}

export async function assertSquareOrderRoutingReady(
  vendorId: string
): Promise<{ ok: true; locationId: string } | { ok: false; error: string; code: string }> {
  const status = await loadSquareOrderRoutingReadiness(vendorId);
  if (status.ready && status.locationId) {
    return { ok: true, locationId: status.locationId };
  }
  return {
    ok: false,
    error: status.missingRequirements.join("; ") || "Square order routing is not ready.",
    code: "SQUARE_ROUTING_NOT_READY",
  };
}

import "server-only";

import { MenuVersionState } from "@prisma/client";
import { mennyuCanonicalMenuSchema } from "@/domain/menu-import/canonical.schema";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { loadActiveMenuVersionForVendor } from "@/lib/vendor-active-menu-version.server";
import { isSquareRoutingMode } from "@/lib/vendor-order-routing-mode";
import { evaluateSquareConnectionHealth, getActiveSquareConnectionForVendor } from "@/lib/integrations/square/square-connection.service";
import {
  evaluateSquareOAuthScopeCoverageFromMeta,
  SQUARE_OAUTH_SCOPE_RECONNECT_MESSAGE,
} from "@/lib/integrations/square/square-oauth-scopes";

export type SquareOrderRoutingReadiness = {
  /** All technical prerequisites except admin enablement and global live switch. */
  prerequisitesReady: boolean;
  /** Paid orders will inject when checkout routing runs (prerequisites + enabled + SQUARE_ROUTING_LIVE). */
  injectionOperationalReady: boolean;
  /** @deprecated Prefer injectionOperationalReady — kept for existing callers. */
  ready: boolean;
  enabled: boolean;
  globalRoutingLive: boolean;
  connectionHealthy: boolean;
  hasSquarePublishedMenu: boolean;
  locationId: string | null;
  activeItemMappingCount: number;
  activeModifierMappingCount: number;
  /** Blockers for enabling injection (excludes squareOrderRoutingEnabled). */
  prerequisiteBlockers: string[];
  /** Full list of reasons injection is not operational right now. */
  injectionBlockingReasons: string[];
  /** @deprecated Prefer injectionBlockingReasons — kept for existing callers. */
  missingRequirements: string[];
};

async function countActiveSquareMappings(vendorId: string, locationId: string | null) {
  const base = {
    vendorId,
    provider: "square" as const,
    isActive: true,
    ...(locationId?.trim() ? { externalLocationId: locationId.trim() } : {}),
  };

  const [activeItemMappingCount, activeModifierMappingCount] = await Promise.all([
    prisma.providerEntityMapping.count({
      where: { ...base, internalEntityType: "menu_item" },
    }),
    prisma.providerEntityMapping.count({
      where: { ...base, internalEntityType: "modifier_option" },
    }),
  ]);

  return { activeItemMappingCount, activeModifierMappingCount };
}

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

  const globalRoutingLive = env.SQUARE_ROUTING_LIVE === "true";
  const prerequisiteBlockers: string[] = [];
  const injectionBlockingReasons: string[] = [];

  if (!vendor) {
    const message = "Vendor not found";
    return {
      prerequisitesReady: false,
      injectionOperationalReady: false,
      ready: false,
      enabled: false,
      globalRoutingLive,
      connectionHealthy: false,
      hasSquarePublishedMenu: false,
      locationId: null,
      activeItemMappingCount: 0,
      activeModifierMappingCount: 0,
      prerequisiteBlockers: [message],
      injectionBlockingReasons: [message],
      missingRequirements: [message],
    };
  }

  const squareMode = isSquareRoutingMode(vendor.orderRoutingMode);
  if (!squareMode) {
    prerequisiteBlockers.push("Order routing mode is not Square.");
  }

  const enabled = vendor.squareOrderRoutingEnabled === true;

  const [health, connection, activeMenu] = await Promise.all([
    evaluateSquareConnectionHealth(vendorId),
    getActiveSquareConnectionForVendor(vendorId),
    loadActiveMenuVersionForVendor(vendorId, "open_order"),
  ]);

  const connectionHealthy = health.isReady;
  if (!connectionHealthy) {
    prerequisiteBlockers.push(...health.missingRequirements);
  }

  const scopeCoverage = evaluateSquareOAuthScopeCoverageFromMeta(connection?.capabilitiesMeta);
  if (!scopeCoverage.hasOrderInjectionScopes) {
    prerequisiteBlockers.push(SQUARE_OAUTH_SCOPE_RECONNECT_MESSAGE);
    if (scopeCoverage.missingRequiredScopes.length > 0) {
      prerequisiteBlockers.push(
        `Missing Square OAuth scopes: ${scopeCoverage.missingRequiredScopes.join(", ")}`
      );
    }
  }

  const locationId = connection?.externalLocationId ?? null;
  if (!locationId?.trim()) {
    prerequisiteBlockers.push("Square location is not selected.");
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
    prerequisiteBlockers.push("Published menu must be imported from Square before order routing.");
  }

  const { activeItemMappingCount, activeModifierMappingCount } = await countActiveSquareMappings(
    vendorId,
    locationId
  );

  if (hasSquarePublishedMenu && activeItemMappingCount === 0) {
    prerequisiteBlockers.push("No active Square item mappings for the selected location.");
  }

  const prerequisitesReady =
    squareMode &&
    connectionHealthy &&
    scopeCoverage.hasOrderInjectionScopes &&
    Boolean(locationId?.trim()) &&
    hasSquarePublishedMenu &&
    activeItemMappingCount > 0;

  if (!enabled) {
    injectionBlockingReasons.push("Square order injection is disabled for this vendor.");
  }
  injectionBlockingReasons.push(...prerequisiteBlockers);
  if (!globalRoutingLive) {
    injectionBlockingReasons.push(
      "SQUARE_ROUTING_LIVE is not true — Square CreateOrder/CreatePayment API calls are blocked globally."
    );
  }

  const injectionOperationalReady =
    prerequisitesReady && enabled && globalRoutingLive;

  return {
    prerequisitesReady,
    injectionOperationalReady,
    ready: injectionOperationalReady,
    enabled,
    globalRoutingLive,
    connectionHealthy,
    hasSquarePublishedMenu,
    locationId,
    activeItemMappingCount,
    activeModifierMappingCount,
    prerequisiteBlockers,
    injectionBlockingReasons,
    missingRequirements: injectionBlockingReasons,
  };
}

export async function assertSquareOrderRoutingPrerequisites(
  vendorId: string
): Promise<{ ok: true; locationId: string } | { ok: false; error: string; code: string }> {
  const status = await loadSquareOrderRoutingReadiness(vendorId);
  if (status.prerequisitesReady && status.locationId) {
    return { ok: true, locationId: status.locationId };
  }
  return {
    ok: false,
    error: status.prerequisiteBlockers.join("; ") || "Square order routing prerequisites are not met.",
    code: "SQUARE_ROUTING_NOT_READY",
  };
}

export async function assertSquareOrderRoutingReady(
  vendorId: string
): Promise<{ ok: true; locationId: string } | { ok: false; error: string; code: string }> {
  const status = await loadSquareOrderRoutingReadiness(vendorId);
  if (status.prerequisitesReady && status.enabled && status.locationId) {
    return { ok: true, locationId: status.locationId };
  }
  const blockers = status.enabled
    ? status.prerequisiteBlockers
    : status.injectionBlockingReasons.filter((reason) => !reason.includes("SQUARE_ROUTING_LIVE"));
  return {
    ok: false,
    error: blockers.join("; ") || "Square order routing is not ready.",
    code: "SQUARE_ROUTING_NOT_READY",
  };
}

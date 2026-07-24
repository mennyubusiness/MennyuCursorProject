import "server-only";

import { MenuVersionState } from "@prisma/client";
import { openOrderCanonicalMenuSchema } from "@/domain/menu-import/canonical.schema";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { loadActiveMenuVersionForVendor } from "@/lib/vendor-active-menu-version.server";
import { isSquareRoutingMode } from "@/lib/vendor-order-routing-mode";
import { evaluateSquareConnectionHealth, getActiveSquareConnectionForVendor } from "@/lib/integrations/square/square-connection.service";
import {
  evaluateSquareOAuthScopeCoverageFromMeta,
  SQUARE_OAUTH_SCOPE_RECONNECT_MESSAGE,
} from "@/lib/integrations/square/square-oauth-scopes";
import {
  evaluateSquareMenuMappingCoverage,
  type SquareMenuMappingCoverage,
  type SquareRoutingReadinessBlocker,
} from "@/lib/integrations/square/square-mapping-coverage.server";

export type { SquareMenuMappingCoverage, SquareRoutingReadinessBlocker };

export type SquareOrderRoutingReadiness = {
  /** All technical prerequisites for Square routing (connection, location, menu, full mapping coverage, scopes). */
  prerequisitesReady: boolean;
  /** Paid orders will route to Square when post-payment routing runs. */
  injectionOperationalReady: boolean;
  /** @deprecated Prefer injectionOperationalReady — kept for existing callers. */
  ready: boolean;
  /** @deprecated squareOrderRoutingEnabled is ignored — orderRoutingMode=square is the gate. */
  enabled: boolean;
  globalRoutingLive: boolean;
  connectionHealthy: boolean;
  hasSquarePublishedMenu: boolean;
  locationId: string | null;
  activeItemMappingCount: number;
  activeModifierMappingCount: number;
  /** Full sellable-menu mapping coverage at the selected location. */
  mappingCoverage: SquareMenuMappingCoverage;
  prerequisiteBlockers: string[];
  injectionBlockingReasons: string[];
  /** Structured coverage / routing blockers (machine-readable). */
  coverageBlockers: SquareRoutingReadinessBlocker[];
  /** @deprecated Prefer injectionBlockingReasons — kept for existing callers. */
  missingRequirements: string[];
};

const SQUARE_ROUTING_LIVE_BLOCKER =
  "Square routing is selected, but live Square API routing is disabled globally (SQUARE_ROUTING_LIVE is not true).";

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

function emptyCoverage(locationId: string | null): SquareMenuMappingCoverage {
  return {
    ready: false,
    totalSellableItems: 0,
    mappedSellableItems: 0,
    missingItemIds: [],
    missingVariationIds: [],
    missingRequiredModifierGroupIds: [],
    missingRequiredModifierOptionIds: [],
    selectedLocationId: locationId,
    mappingsExistForAnotherLocation: false,
    alternateLocationIds: [],
    blockers: [],
  };
}

export async function loadSquareOrderRoutingReadiness(
  vendorId: string
): Promise<SquareOrderRoutingReadiness> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      orderRoutingMode: true,
      // Deprecated: retained in schema only; routing mode is the source of truth.
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
      mappingCoverage: emptyCoverage(null),
      prerequisiteBlockers: [message],
      injectionBlockingReasons: [message],
      coverageBlockers: [],
      missingRequirements: [message],
    };
  }

  const squareMode = isSquareRoutingMode(vendor.orderRoutingMode);
  if (!squareMode) {
    prerequisiteBlockers.push("Order routing mode is not Square.");
  }

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
      ? openOrderCanonicalMenuSchema.safeParse(published.canonicalSnapshot)
      : null;
    hasSquarePublishedMenu =
      parsed?.success === true &&
      parsed.data.deliverect.sourcePayloadKind === "square_catalog_v1";
  }

  if (!hasSquarePublishedMenu) {
    prerequisiteBlockers.push("Published menu must be imported from Square before order routing.");
  }

  const [{ activeItemMappingCount, activeModifierMappingCount }, mappingCoverage] =
    await Promise.all([
      countActiveSquareMappings(vendorId, locationId),
      evaluateSquareMenuMappingCoverage({
        vendorId,
        selectedLocationId: locationId,
      }),
    ]);

  if (hasSquarePublishedMenu && mappingCoverage.totalSellableItems > 0 && !mappingCoverage.ready) {
    const coverageSummary = `${mappingCoverage.mappedSellableItems} of ${mappingCoverage.totalSellableItems} sellable items have complete Square mappings at the selected location.`;
    prerequisiteBlockers.push(coverageSummary);

    if (mappingCoverage.mappingsExistForAnotherLocation) {
      prerequisiteBlockers.push(
        "Some sellable items are mapped only at another Square location. Re-import and publish the menu for the selected location."
      );
    }
    if (mappingCoverage.missingRequiredModifierOptionIds.length > 0) {
      prerequisiteBlockers.push(
        `${mappingCoverage.missingRequiredModifierOptionIds.length} required modifier option(s) lack Square mappings at the selected location.`
      );
    }
  }

  if (
    hasSquarePublishedMenu &&
    mappingCoverage.totalSellableItems === 0 &&
    activeItemMappingCount === 0
  ) {
    // Published Square menu with nothing sellable yet — still block injection until there is
    // something mapped, matching prior "no mappings" gate for empty/broken menus.
    prerequisiteBlockers.push("No active Square item mappings for the selected location.");
  }

  const coverageReady =
    mappingCoverage.ready &&
    (mappingCoverage.totalSellableItems > 0 || activeItemMappingCount > 0);

  const prerequisitesReady =
    squareMode &&
    connectionHealthy &&
    scopeCoverage.hasOrderInjectionScopes &&
    Boolean(locationId?.trim()) &&
    hasSquarePublishedMenu &&
    coverageReady;

  injectionBlockingReasons.push(...prerequisiteBlockers);
  if (!globalRoutingLive) {
    injectionBlockingReasons.push(SQUARE_ROUTING_LIVE_BLOCKER);
  }

  const injectionOperationalReady = prerequisitesReady && globalRoutingLive;

  return {
    prerequisitesReady,
    injectionOperationalReady,
    ready: injectionOperationalReady,
    enabled: vendor.squareOrderRoutingEnabled === true,
    globalRoutingLive,
    connectionHealthy,
    hasSquarePublishedMenu,
    locationId,
    activeItemMappingCount,
    activeModifierMappingCount,
    mappingCoverage,
    prerequisiteBlockers,
    injectionBlockingReasons,
    coverageBlockers: mappingCoverage.blockers,
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
  if (status.injectionOperationalReady && status.locationId) {
    return { ok: true, locationId: status.locationId };
  }
  return {
    ok: false,
    error: status.injectionBlockingReasons.join("; ") || "Square order routing is not ready.",
    code: "SQUARE_ROUTING_NOT_READY",
  };
}

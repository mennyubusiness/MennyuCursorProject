/**
 * Read-only Square mapping / connection diagnostics for admin debug.
 * Does not affect routing success/failure behavior.
 */
import "server-only";

import { MenuVersionState } from "@prisma/client";
import { openOrderCanonicalMenuSchema } from "@/domain/menu-import/canonical.schema";
import { prisma } from "@/lib/db";
import { loadActiveMenuVersionForVendor } from "@/lib/vendor-active-menu-version.server";
import { getActiveSquareConnectionForVendor } from "@/lib/integrations/square/square-connection.service";

export type SquareMappingCountByKey = {
  key: string | null;
  totalCount: number;
  itemCount: number;
  modifierCount: number;
};

export type SquareUnmappedPublishedItem = {
  id: string;
  name: string;
};

export type SquareMappingExternalSample = {
  externalId: string;
  internalEntityId: string;
  internalEntityType: string;
  externalLocationId: string | null;
  connectionId: string | null;
};

export type SquareVendorMappingDiagnostics = {
  vendorId: string;
  vendorName: string;
  orderRoutingMode: string;
  activeSquareConnectionId: string | null;
  externalMerchantId: string | null;
  externalLocationId: string | null;
  connectionStatus: string | null;
  credentialRefPresent: boolean;
  activeSquareConnectionCount: number;
  squareConnections: Array<{
    id: string;
    isActive: boolean;
    status: string;
    externalMerchantId: string | null;
    externalLocationId: string | null;
    credentialRefPresent: boolean;
    updatedAt: string;
  }>;
  publishedMenuVersionId: string | null;
  publishedSourcePayloadKind: string | null;
  activePublishedItemCount: number;
  activeSquareProviderEntityMappingCountForVendorAndLocation: number;
  activeSquareItemMappingsForVendorAndLocation: number;
  activeSquareModifierMappingsForVendorAndLocation: number;
  activeSquareMappingsByLocation: SquareMappingCountByKey[];
  activeSquareMappingsByConnectionId: SquareMappingCountByKey[];
  mappingsExistForAnotherLocation: boolean;
  first10UnmappedPublishedItems: SquareUnmappedPublishedItem[];
  first10MappingExternalIds: SquareMappingExternalSample[];
};

export type SquareVendorOrderMappingFailureDiagnostics = {
  vendorOrderId: string;
  vendorId: string;
  connectionIdUsed: string | null;
  externalMerchantIdUsed: string | null;
  externalLocationIdUsed: string | null;
  mappingCountForVendorLocation: number;
  itemMappingCountForVendorLocation: number;
  modifierMappingCountForVendorLocation: number;
  mappingLocationsFoundForVendor: Array<{ externalLocationId: string | null; count: number }>;
  orderedItems: Array<{ menuItemId: string; name: string; deliverectProductId: string | null }>;
  missingMappingItems: Array<{ menuItemId: string; name: string; deliverectProductId: string | null }>;
};

function groupMappingCounts(
  rows: Array<{
    externalLocationId: string | null;
    connectionId: string | null;
    internalEntityType: string;
  }>,
  keyOf: (row: (typeof rows)[number]) => string | null
): SquareMappingCountByKey[] {
  const map = new Map<string, SquareMappingCountByKey>();
  for (const row of rows) {
    const key = keyOf(row);
    const bucketKey = key ?? "__null__";
    const existing = map.get(bucketKey) ?? {
      key,
      totalCount: 0,
      itemCount: 0,
      modifierCount: 0,
    };
    existing.totalCount += 1;
    if (row.internalEntityType === "menu_item") existing.itemCount += 1;
    if (row.internalEntityType === "modifier_option") existing.modifierCount += 1;
    map.set(bucketKey, existing);
  }
  return [...map.values()].sort((a, b) => b.totalCount - a.totalCount);
}

export async function loadSquareVendorMappingDiagnostics(
  vendorId: string
): Promise<SquareVendorMappingDiagnostics | null> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { id: true, name: true, orderRoutingMode: true },
  });
  if (!vendor) return null;

  const [connection, allConnections, activeMappings, activeMenu] = await Promise.all([
    getActiveSquareConnectionForVendor(vendorId),
    prisma.vendorIntegrationConnection.findMany({
      where: { vendorId, provider: "square" },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        isActive: true,
        status: true,
        externalMerchantId: true,
        externalLocationId: true,
        accessTokenRef: true,
        updatedAt: true,
      },
    }),
    prisma.providerEntityMapping.findMany({
      where: { vendorId, provider: "square", isActive: true },
      select: {
        externalId: true,
        internalEntityId: true,
        internalEntityType: true,
        externalLocationId: true,
        connectionId: true,
      },
    }),
    loadActiveMenuVersionForVendor(vendorId, "open_order"),
  ]);

  const selectedLocationId = connection?.externalLocationId?.trim() || null;

  const mappingsAtSelectedLocation = selectedLocationId
    ? activeMappings.filter((m) => m.externalLocationId === selectedLocationId)
    : [];

  const itemMappingsAtLocation = mappingsAtSelectedLocation.filter(
    (m) => m.internalEntityType === "menu_item"
  );
  const modifierMappingsAtLocation = mappingsAtSelectedLocation.filter(
    (m) => m.internalEntityType === "modifier_option"
  );

  const byLocation = groupMappingCounts(activeMappings, (r) => r.externalLocationId);
  const byConnection = groupMappingCounts(activeMappings, (r) => r.connectionId);

  const mappingsExistForAnotherLocation =
    Boolean(selectedLocationId) &&
    activeMappings.some(
      (m) =>
        m.internalEntityType === "menu_item" &&
        m.externalLocationId != null &&
        m.externalLocationId !== selectedLocationId
    );

  let publishedMenuVersionId: string | null = null;
  let publishedSourcePayloadKind: string | null = null;
  let activePublishedItemCount = 0;
  let publishedProducts: Array<{ id: string; name: string }> = [];

  if (activeMenu?.state === MenuVersionState.published && activeMenu.menu) {
    publishedMenuVersionId = activeMenu.id;
    publishedSourcePayloadKind = activeMenu.menu.deliverect.sourcePayloadKind ?? null;
    publishedProducts = activeMenu.menu.products
      .filter((p) => p.isAvailable)
      .map((p) => ({ id: p.deliverectId, name: p.name }));
    activePublishedItemCount = publishedProducts.length;
  } else {
    const published = await prisma.menuVersion.findFirst({
      where: { vendorId, state: MenuVersionState.published },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: { id: true, canonicalSnapshot: true },
    });
    if (published) {
      publishedMenuVersionId = published.id;
      const parsed = openOrderCanonicalMenuSchema.safeParse(published.canonicalSnapshot);
      if (parsed.success) {
        publishedSourcePayloadKind = parsed.data.deliverect.sourcePayloadKind ?? null;
        publishedProducts = parsed.data.products
          .filter((p) => p.isAvailable)
          .map((p) => ({ id: p.deliverectId, name: p.name }));
        activePublishedItemCount = publishedProducts.length;
      }
    }
  }

  const mappedInternalIds = new Set(
    itemMappingsAtLocation.map((m) => m.internalEntityId)
  );
  const first10UnmappedPublishedItems = publishedProducts
    .filter((p) => !mappedInternalIds.has(p.id))
    .slice(0, 10);

  const first10MappingExternalIds = itemMappingsAtLocation.slice(0, 10).map((m) => ({
    externalId: m.externalId,
    internalEntityId: m.internalEntityId,
    internalEntityType: m.internalEntityType,
    externalLocationId: m.externalLocationId,
    connectionId: m.connectionId,
  }));

  return {
    vendorId: vendor.id,
    vendorName: vendor.name,
    orderRoutingMode: vendor.orderRoutingMode,
    activeSquareConnectionId: connection?.id ?? null,
    externalMerchantId: connection?.externalMerchantId ?? null,
    externalLocationId: selectedLocationId,
    connectionStatus: connection?.status ?? null,
    credentialRefPresent: Boolean(connection?.accessTokenRef?.trim()),
    activeSquareConnectionCount: allConnections.filter((c) => c.isActive).length,
    squareConnections: allConnections.map((c) => ({
      id: c.id,
      isActive: c.isActive,
      status: c.status,
      externalMerchantId: c.externalMerchantId,
      externalLocationId: c.externalLocationId,
      credentialRefPresent: Boolean(c.accessTokenRef?.trim()),
      updatedAt: c.updatedAt.toISOString(),
    })),
    publishedMenuVersionId,
    publishedSourcePayloadKind,
    activePublishedItemCount,
    activeSquareProviderEntityMappingCountForVendorAndLocation: mappingsAtSelectedLocation.length,
    activeSquareItemMappingsForVendorAndLocation: itemMappingsAtLocation.length,
    activeSquareModifierMappingsForVendorAndLocation: modifierMappingsAtLocation.length,
    activeSquareMappingsByLocation: byLocation,
    activeSquareMappingsByConnectionId: byConnection,
    mappingsExistForAnotherLocation,
    first10UnmappedPublishedItems,
    first10MappingExternalIds,
  };
}

export async function buildSquareVendorOrderMappingFailureDiagnostics(input: {
  vendorOrderId: string;
  vendorId: string;
}): Promise<SquareVendorOrderMappingFailureDiagnostics> {
  const [connection, vendorMappings, lineItems] = await Promise.all([
    getActiveSquareConnectionForVendor(input.vendorId),
    prisma.providerEntityMapping.findMany({
      where: {
        vendorId: input.vendorId,
        provider: "square",
        isActive: true,
      },
      select: {
        internalEntityId: true,
        internalEntityType: true,
        externalLocationId: true,
      },
    }),
    prisma.orderLineItem.findMany({
      where: { vendorOrderId: input.vendorOrderId },
      select: {
        menuItemId: true,
        name: true,
        menuItem: { select: { deliverectProductId: true } },
      },
    }),
  ]);

  const locationId = connection?.externalLocationId?.trim() || null;
  const atLocation = locationId
    ? vendorMappings.filter((m) => m.externalLocationId === locationId)
    : [];
  const itemAtLocation = atLocation.filter((m) => m.internalEntityType === "menu_item");
  const modAtLocation = atLocation.filter((m) => m.internalEntityType === "modifier_option");

  const locationBuckets = new Map<string | null, number>();
  for (const m of vendorMappings) {
    const key = m.externalLocationId;
    locationBuckets.set(key, (locationBuckets.get(key) ?? 0) + 1);
  }

  const mappedIds = new Set(itemAtLocation.map((m) => m.internalEntityId));
  const orderedItems = lineItems.map((li) => ({
    menuItemId: li.menuItemId,
    name: li.name,
    deliverectProductId: li.menuItem?.deliverectProductId ?? null,
  }));

  const missingMappingItems = orderedItems.filter((item) => {
    const productId = item.deliverectProductId?.trim();
    if (!productId) return true;
    return !mappedIds.has(productId);
  });

  return {
    vendorOrderId: input.vendorOrderId,
    vendorId: input.vendorId,
    connectionIdUsed: connection?.id ?? null,
    externalMerchantIdUsed: connection?.externalMerchantId ?? null,
    externalLocationIdUsed: locationId,
    mappingCountForVendorLocation: atLocation.length,
    itemMappingCountForVendorLocation: itemAtLocation.length,
    modifierMappingCountForVendorLocation: modAtLocation.length,
    mappingLocationsFoundForVendor: [...locationBuckets.entries()].map(
      ([externalLocationId, count]) => ({ externalLocationId, count })
    ),
    orderedItems,
    missingMappingItems,
  };
}

export function isSquareNoActiveItemMappingsError(error: string | null | undefined): boolean {
  return /No active Square item mappings for the selected location/i.test(error ?? "");
}

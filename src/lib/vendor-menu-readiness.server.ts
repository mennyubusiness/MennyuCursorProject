import "server-only";

import { MenuVersionState } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getOperationalMenuItemIdsForVendor } from "@/services/menu-active-scope.service";
import type { VendorMenuReadinessSummary } from "@/lib/vendor-pod-readiness";

/**
 * Batch-load menu readiness summaries for pod dashboard / vendor settings.
 * Uses operational menu scope (published snapshot or legacy fallback) + isAvailable.
 */
export async function loadVendorMenuReadinessSummaries(
  vendorIds: string[]
): Promise<Map<string, VendorMenuReadinessSummary>> {
  const uniqueIds = [...new Set(vendorIds.filter(Boolean))];
  const result = new Map<string, VendorMenuReadinessSummary>();
  if (uniqueIds.length === 0) return result;

  const publishedByVendor = await prisma.menuVersion.groupBy({
    by: ["vendorId"],
    where: { vendorId: { in: uniqueIds }, state: MenuVersionState.published },
    _count: { _all: true },
  });
  const hasPublished = new Map(publishedByVendor.map((row) => [row.vendorId, row._count._all > 0]));

  const operationalSets = await Promise.all(uniqueIds.map((id) => getOperationalMenuItemIdsForVendor(id)));
  const allOperationalIds = new Set<string>();
  for (const set of operationalSets) {
    for (const id of set) allOperationalIds.add(id);
  }

  const availableByVendorId = new Map<string, boolean>();
  if (allOperationalIds.size > 0) {
    const availableRows = await prisma.menuItem.findMany({
      where: { id: { in: [...allOperationalIds] }, isAvailable: true },
      select: { vendorId: true },
      distinct: ["vendorId"],
    });
    for (const row of availableRows) {
      availableByVendorId.set(row.vendorId, true);
    }
  }

  for (let i = 0; i < uniqueIds.length; i++) {
    const vendorId = uniqueIds[i]!;
    const operational = operationalSets[i]!;
    result.set(vendorId, {
      hasPublishedMenuVersion: hasPublished.get(vendorId) ?? false,
      hasOperationalItems: operational.size > 0,
      hasAvailableOperationalItems: availableByVendorId.has(vendorId),
    });
  }

  return result;
}

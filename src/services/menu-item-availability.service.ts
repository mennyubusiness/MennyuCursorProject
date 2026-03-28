/**
 * Customer menu and cart: only **operationally active** MenuItem rows (see `menu-active-scope.service`)
 * participate. Effective availability is `operational && row.isAvailable` (snooze/unsnooze on the active row).
 */
import "server-only";

import { prisma } from "@/lib/db";
import {
  getOperationalMenuItemIdsForVendor,
  isMenuItemIdOperational,
} from "@/services/menu-active-scope.service";

export type MenuItemAvailabilityRow = {
  id: string;
  vendorId: string;
  deliverectProductId: string | null;
  isAvailable: boolean;
};

export async function isMenuItemEffectivelyAvailable(row: MenuItemAvailabilityRow): Promise<boolean> {
  const operational = await isMenuItemIdOperational(row.vendorId, row.id);
  if (!operational) return false;
  return row.isAvailable;
}

/**
 * Batch resolve effective availability for cart/order validation.
 * Retired MenuItem rows (non-operational) are treated as unavailable.
 */
export async function effectiveAvailabilityByMenuItemId(
  rows: MenuItemAvailabilityRow[]
): Promise<Map<string, boolean>> {
  const out = new Map<string, boolean>();
  if (rows.length === 0) return out;

  const vendorIds = [...new Set(rows.map((r) => r.vendorId))];
  const operationalByVendor = new Map<string, Set<string>>();
  for (const vid of vendorIds) {
    operationalByVendor.set(vid, await getOperationalMenuItemIdsForVendor(vid));
  }

  for (const r of rows) {
    if (!r.deliverectProductId) {
      out.set(r.id, r.isAvailable);
      continue;
    }
    const op = operationalByVendor.get(r.vendorId)?.has(r.id) ?? false;
    if (!op) {
      out.set(r.id, false);
      continue;
    }
    out.set(r.id, r.isAvailable);
  }

  return out;
}

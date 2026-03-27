/**
 * Customer menu and cart must agree: for a given Deliverect product key (`vendorId` + `deliverectProductId`),
 * the product is orderable only if **every** `MenuItem` row for that key is `isAvailable` (matches
 * `loadCustomerVendorMenuSections` merge semantics). Prevents ordering via a stale duplicate row while
 * another sibling is snoozed.
 */
import "server-only";

import { prisma } from "@/lib/db";

export type MenuItemAvailabilityRow = {
  id: string;
  vendorId: string;
  deliverectProductId: string | null;
  isAvailable: boolean;
};

export async function isMenuItemEffectivelyAvailable(row: MenuItemAvailabilityRow): Promise<boolean> {
  if (!row.deliverectProductId) return row.isAvailable;
  const siblings = await prisma.menuItem.findMany({
    where: { vendorId: row.vendorId, deliverectProductId: row.deliverectProductId },
    select: { isAvailable: true },
  });
  if (siblings.length === 0) return row.isAvailable;
  return siblings.every((s) => s.isAvailable);
}

/**
 * Batch resolve effective availability for cart/order validation (one grouped query per distinct product key).
 */
export async function effectiveAvailabilityByMenuItemId(
  rows: MenuItemAvailabilityRow[]
): Promise<Map<string, boolean>> {
  const out = new Map<string, boolean>();
  if (rows.length === 0) return out;

  const groupMeta = new Map<
    string,
    { vendorId: string; deliverectProductId: string; lineIds: string[] }
  >();
  for (const r of rows) {
    if (!r.deliverectProductId) {
      out.set(r.id, r.isAvailable);
      continue;
    }
    const key = `${r.vendorId}\0${r.deliverectProductId}`;
    const g = groupMeta.get(key);
    if (g) g.lineIds.push(r.id);
    else groupMeta.set(key, { vendorId: r.vendorId, deliverectProductId: r.deliverectProductId, lineIds: [r.id] });
  }

  if (groupMeta.size > 0) {
    const orClause = [...groupMeta.values()].map((g) => ({
      vendorId: g.vendorId,
      deliverectProductId: g.deliverectProductId,
    }));
    const siblings = await prisma.menuItem.findMany({
      where: { OR: orClause },
      select: { vendorId: true, deliverectProductId: true, isAvailable: true },
    });

    for (const g of groupMeta.values()) {
      const rel = siblings.filter(
        (s) => s.vendorId === g.vendorId && s.deliverectProductId === g.deliverectProductId
      );
      const effective =
        rel.length > 0
          ? rel.every((s) => s.isAvailable)
          : rows.filter((r) => g.lineIds.includes(r.id)).every((r) => r.isAvailable);
      for (const id of g.lineIds) {
        out.set(id, effective);
      }
    }
  }

  return out;
}

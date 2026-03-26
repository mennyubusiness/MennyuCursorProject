/**
 * Published-menu identity sets for Deliverect snooze: only rows in the current published canonical
 * catalog may receive availability updates (avoids legacy / orphaned MenuItem rows).
 */
import "server-only";

import { MenuVersionState } from "@prisma/client";
import { mennyuCanonicalMenuSchema } from "@/domain/menu-import/canonical.schema";
import { prisma } from "@/lib/db";

export type DeliverectSnoozePublishedScope = {
  /** `deliverectId` (graph id) per product in published snapshot, per vendor. */
  productDeliverectIdsByVendor: Map<string, Set<string>>;
  /** Modifier option `deliverectId` values in published snapshot, per vendor. */
  modifierOptionDeliverectIdsByVendor: Map<string, Set<string>>;
};

export async function loadDeliverectSnoozePublishedScope(
  vendorIds: string[]
): Promise<DeliverectSnoozePublishedScope> {
  const productDeliverectIdsByVendor = new Map<string, Set<string>>();
  const modifierOptionDeliverectIdsByVendor = new Map<string, Set<string>>();

  for (const vendorId of vendorIds) {
    const published = await prisma.menuVersion.findFirst({
      where: { vendorId, state: MenuVersionState.published },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: { canonicalSnapshot: true },
    });

    if (!published?.canonicalSnapshot) {
      productDeliverectIdsByVendor.set(vendorId, new Set());
      modifierOptionDeliverectIdsByVendor.set(vendorId, new Set());
      continue;
    }

    const parsed = mennyuCanonicalMenuSchema.safeParse(published.canonicalSnapshot);
    if (!parsed.success) {
      productDeliverectIdsByVendor.set(vendorId, new Set());
      modifierOptionDeliverectIdsByVendor.set(vendorId, new Set());
      continue;
    }

    const menu = parsed.data;
    productDeliverectIdsByVendor.set(
      vendorId,
      new Set(menu.products.map((p) => p.deliverectId))
    );

    const modOpts = new Set<string>();
    for (const g of menu.modifierGroupDefinitions) {
      for (const o of g.options) {
        modOpts.add(o.deliverectId);
      }
    }
    modifierOptionDeliverectIdsByVendor.set(vendorId, modOpts);
  }

  return { productDeliverectIdsByVendor, modifierOptionDeliverectIdsByVendor };
}

import type { OpenOrderCanonicalProduct } from "@/domain/menu-import/canonical.schema";

/** Count variant leaf products per parent PLU from canonical products. */
export function variantChildCountByParentPluFromProducts(
  products: OpenOrderCanonicalProduct[]
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of products) {
    const parentPlu = p.deliverectVariantParentPlu?.trim();
    if (!parentPlu) continue;
    counts.set(parentPlu, (counts.get(parentPlu) ?? 0) + 1);
  }
  return counts;
}

export function variantChildMenuItemCountForPlu(
  counts: Map<string, number>,
  deliverectPlu: string | null | undefined
): number {
  const plu = deliverectPlu?.trim();
  if (!plu) return 0;
  return counts.get(plu) ?? 0;
}

/** DB-backed variant leaf counts for a vendor (menu publish / cart / order transform). */
export async function loadVariantChildCountByParentPluForVendor(
  vendorId: string,
  prisma: {
    menuItem: {
      findMany: (args: {
        where: { vendorId: string; deliverectVariantParentPlu: { not: null } };
        select: { deliverectVariantParentPlu: true };
      }) => Promise<Array<{ deliverectVariantParentPlu: string | null }>>;
    };
  }
): Promise<Map<string, number>> {
  const leaves = await prisma.menuItem.findMany({
    where: { vendorId, deliverectVariantParentPlu: { not: null } },
    select: { deliverectVariantParentPlu: true },
  });
  const counts = new Map<string, number>();
  for (const row of leaves) {
    const p = row.deliverectVariantParentPlu?.trim();
    if (!p) continue;
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return counts;
}

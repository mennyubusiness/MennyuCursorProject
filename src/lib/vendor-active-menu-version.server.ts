import "server-only";

import { MenuVersionState, type VendorMenuSource } from "@prisma/client";
import {
  mennyuCanonicalMenuSchema,
  type MennyuCanonicalMenu,
} from "@/domain/menu-import/canonical.schema";
import { prisma } from "@/lib/db";
import { canonicalMatchesMenuSource } from "@/lib/vendor-menu-source";

export type ActiveMenuVersionMeta = {
  id: string;
  state: MenuVersionState;
  menu: MennyuCanonicalMenu | null;
};

export async function loadVendorActiveMenuSource(vendorId: string): Promise<VendorMenuSource | null> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { menuSource: true },
  });
  return vendor?.menuSource ?? null;
}

/**
 * Latest published MenuVersion for the vendor's active menu source, or the latest archived
 * snapshot for that source when nothing is currently published (e.g. after switching back).
 */
export async function loadActiveMenuVersionForVendor(
  vendorId: string,
  menuSource?: VendorMenuSource
): Promise<ActiveMenuVersionMeta | null> {
  const source = menuSource ?? (await loadVendorActiveMenuSource(vendorId));
  if (!source) return null;

  const versions = await prisma.menuVersion.findMany({
    where: {
      vendorId,
      state: { in: [MenuVersionState.published, MenuVersionState.archived] },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, state: true, canonicalSnapshot: true },
  });

  const pick = (state: MenuVersionState) => {
    for (const version of versions) {
      if (version.state !== state) continue;
      if (!canonicalMatchesMenuSource(version.canonicalSnapshot, source)) continue;
      const parsed = mennyuCanonicalMenuSchema.safeParse(version.canonicalSnapshot);
      return {
        id: version.id,
        state: version.state,
        menu: parsed.success ? parsed.data : null,
      };
    }
    return null;
  };

  return pick(MenuVersionState.published) ?? pick(MenuVersionState.archived);
}

export async function loadActiveMenuVersionIdForVendor(
  vendorId: string,
  menuSource?: VendorMenuSource
): Promise<string | null> {
  const meta = await loadActiveMenuVersionForVendor(vendorId, menuSource);
  return meta?.id ?? null;
}

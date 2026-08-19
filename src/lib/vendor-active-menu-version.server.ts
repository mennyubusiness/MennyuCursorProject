import "server-only";

import { MenuVersionState, type VendorMenuSource } from "@prisma/client";
import {
  openOrderCanonicalMenuSchema,
  type OpenOrderCanonicalMenu,
} from "@/domain/menu-import/canonical.schema";
import { prisma } from "@/lib/db";
import {
  activeMenuProviderFromMenuSourceHint,
  canonicalMatchesActiveProvider,
  resolveActiveMenuSource,
  snapshotIsNativeOpenOrderBuilder,
  snapshotServesOpenOrderAuthority,
  type ActiveMenuProvider,
} from "@/lib/vendor-menu-source";

export type ActiveMenuVersionMeta = {
  id: string;
  state: MenuVersionState;
  menu: OpenOrderCanonicalMenu | null;
  provider: ActiveMenuProvider;
};

export type LoadActiveMenuVersionOptions = {
  /** Legacy VendorMenuSource hint; Square vs native is disambiguated via routing mode. */
  menuSource?: VendorMenuSource;
  /** Explicit provider filter (wins over menuSource hint). */
  provider?: ActiveMenuProvider;
};

export async function loadVendorActiveMenuSource(vendorId: string): Promise<VendorMenuSource | null> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { menuSource: true, orderRoutingMode: true },
  });
  if (!vendor) return null;
  return resolveActiveMenuSource(vendor).menuSource;
}

function normalizeLoadOptions(
  menuSourceOrOptions?: VendorMenuSource | LoadActiveMenuVersionOptions
): LoadActiveMenuVersionOptions {
  if (menuSourceOrOptions == null) return {};
  if (typeof menuSourceOrOptions === "string") {
    return { menuSource: menuSourceOrOptions };
  }
  return menuSourceOrOptions;
}

/**
 * Latest published MenuVersion for the vendor's active menu provider, or the latest archived
 * snapshot for that provider when nothing is currently published (e.g. after switching back).
 *
 * Active provider is derived from orderRoutingMode (one authoritative catalog per vendor).
 * Stale published menus from other providers are never selected.
 */
export async function loadActiveMenuVersionForVendor(
  vendorId: string,
  menuSourceOrOptions?: VendorMenuSource | LoadActiveMenuVersionOptions
): Promise<ActiveMenuVersionMeta | null> {
  const options = normalizeLoadOptions(menuSourceOrOptions);
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { menuSource: true, orderRoutingMode: true },
  });
  if (!vendor) return null;

  const resolved = resolveActiveMenuSource(vendor);
  const provider: ActiveMenuProvider =
    options.provider ??
    (options.menuSource
      ? activeMenuProviderFromMenuSourceHint(options.menuSource, vendor.orderRoutingMode)
      : resolved.provider);

  const versions = await prisma.menuVersion.findMany({
    where: {
      vendorId,
      state: { in: [MenuVersionState.published, MenuVersionState.archived] },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, state: true, canonicalSnapshot: true },
  });

  const toMeta = (version: (typeof versions)[number]) => {
    const parsed = openOrderCanonicalMenuSchema.safeParse(version.canonicalSnapshot);
    return {
      id: version.id,
      state: version.state,
      menu: parsed.success ? parsed.data : null,
      provider,
    };
  };

  const pickMatching = (
    state: MenuVersionState,
    matches: (snapshot: unknown) => boolean
  ) => {
    for (const version of versions) {
      if (version.state !== state) continue;
      if (!matches(version.canonicalSnapshot)) continue;
      return toMeta(version);
    }
    return null;
  };

  if (provider === "open_order") {
    return (
      pickMatching(MenuVersionState.published, snapshotIsNativeOpenOrderBuilder) ??
      pickMatching(MenuVersionState.published, snapshotServesOpenOrderAuthority) ??
      pickMatching(MenuVersionState.archived, snapshotIsNativeOpenOrderBuilder) ??
      pickMatching(MenuVersionState.archived, snapshotServesOpenOrderAuthority)
    );
  }

  return (
    pickMatching(MenuVersionState.published, (snapshot) =>
      canonicalMatchesActiveProvider(snapshot, provider)
    ) ??
    pickMatching(MenuVersionState.archived, (snapshot) =>
      canonicalMatchesActiveProvider(snapshot, provider)
    )
  );
}

export async function loadActiveMenuVersionIdForVendor(
  vendorId: string,
  menuSourceOrOptions?: VendorMenuSource | LoadActiveMenuVersionOptions
): Promise<string | null> {
  const meta = await loadActiveMenuVersionForVendor(vendorId, menuSourceOrOptions);
  return meta?.id ?? null;
}

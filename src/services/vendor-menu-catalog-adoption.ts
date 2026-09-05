import { MenuVersionState } from "@prisma/client";
import { openOrderCanonicalMenuSchema } from "@/domain/menu-import/canonical.schema";
import { menuSourceProvider } from "@/domain/menu-import/menu-source-provider";
import {
  canonicalActiveProviderFromSnapshot,
  snapshotIsNativeOpenOrderBuilder,
} from "@/lib/vendor-menu-source";

export type CatalogAdoptionSource = "square" | "deliverect" | "other";

export type MenuVersionAdoptionCandidate = {
  id: string;
  state: MenuVersionState | string;
  publishedAt: Date | null;
  createdAt: Date;
  canonicalSnapshot: unknown;
};

export type ProviderCatalogStats = {
  sourcePayloadKind: string | null;
  adoptionSource: CatalogAdoptionSource;
  productCount: number;
  availableProductCount: number;
  unavailableProductCount: number;
  parseable: boolean;
};

export type SelectedProviderCatalog = ProviderCatalogStats & {
  id: string;
  state: string;
  currentlyArchived: boolean;
  publishedAt: string | null;
  createdAt: string;
};

function sourcePayloadKind(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const kind = (snapshot as { deliverect?: { sourcePayloadKind?: unknown } }).deliverect
    ?.sourcePayloadKind;
  return typeof kind === "string" ? kind : null;
}

export function catalogStatsFromSnapshot(snapshot: unknown): ProviderCatalogStats {
  const kind = sourcePayloadKind(snapshot);
  const origin = canonicalActiveProviderFromSnapshot(snapshot);
  const adoptionSource: CatalogAdoptionSource =
    origin === "square" ? "square" : origin === "deliverect" ? "deliverect" : "other";
  const parsed = openOrderCanonicalMenuSchema.safeParse(snapshot);
  if (!parsed.success) {
    const products = (snapshot as { products?: unknown })?.products;
    const count = Array.isArray(products) ? products.length : 0;
    return {
      sourcePayloadKind: kind,
      adoptionSource,
      productCount: count,
      availableProductCount: 0,
      unavailableProductCount: count,
      parseable: false,
    };
  }
  const availableProductCount = parsed.data.products.filter((p) => p.isAvailable).length;
  return {
    sourcePayloadKind: kind ?? parsed.data.deliverect.sourcePayloadKind,
    adoptionSource,
    productCount: parsed.data.products.length,
    availableProductCount,
    unavailableProductCount: parsed.data.products.length - availableProductCount,
    parseable: true,
  };
}

export function snapshotAvailableProductIds(snapshot: unknown): string[] {
  const parsed = openOrderCanonicalMenuSchema.safeParse(snapshot);
  if (!parsed.success) return [];
  return parsed.data.products.filter((p) => p.isAvailable).map((p) => p.deliverectId);
}

export function snapshotProductIds(snapshot: unknown): string[] {
  const parsed = openOrderCanonicalMenuSchema.safeParse(snapshot);
  if (!parsed.success) return [];
  return parsed.data.products.map((p) => p.deliverectId);
}

function isProviderCatalog(snapshot: unknown): boolean {
  const origin = canonicalActiveProviderFromSnapshot(snapshot);
  return origin === "square" || origin === "deliverect";
}

/**
 * Same selection as reconcile: newest published Square/Deliverect catalog, else newest archived.
 * Versions must already be ordered by publishedAt desc, createdAt desc.
 */
export function pickAdoptedProviderCatalog<T extends MenuVersionAdoptionCandidate>(
  versions: T[]
): T | null {
  const candidates = versions.filter((row) => isProviderCatalog(row.canonicalSnapshot));
  return (
    candidates.find((row) => row.state === MenuVersionState.published) ?? candidates[0] ?? null
  );
}

export function providerOriginsAmong(versions: MenuVersionAdoptionCandidate[]): CatalogAdoptionSource[] {
  const origins = new Set<CatalogAdoptionSource>();
  for (const row of versions) {
    if (!isProviderCatalog(row.canonicalSnapshot)) continue;
    const stats = catalogStatsFromSnapshot(row.canonicalSnapshot);
    if (stats.productCount === 0) continue;
    origins.add(stats.adoptionSource);
  }
  return [...origins];
}

export function selectionReasonForAdoptedCatalog(input: {
  selected: MenuVersionAdoptionCandidate;
  versions: MenuVersionAdoptionCandidate[];
}): string {
  const selectedOrigin = catalogStatsFromSnapshot(input.selected.canonicalSnapshot).adoptionSource;
  const sameOrigin = input.versions.filter((row) => {
    if (!isProviderCatalog(row.canonicalSnapshot)) return false;
    return catalogStatsFromSnapshot(row.canonicalSnapshot).adoptionSource === selectedOrigin;
  });
  const publishedSame = sameOrigin.filter((row) => row.state === MenuVersionState.published);
  if (input.selected.state === MenuVersionState.published) {
    return `Newest published ${selectedOrigin} catalog (publishedAt/createdAt desc). ${sameOrigin.length} ${selectedOrigin} version(s) exist.`;
  }
  if (publishedSame.length === 0) {
    return `No published ${selectedOrigin} catalog; newest archived ${selectedOrigin} catalog (publishedAt/createdAt desc).`;
  }
  return `Newest ${selectedOrigin} catalog after published rows.`;
}

export function toSelectedProviderCatalog(
  row: MenuVersionAdoptionCandidate
): SelectedProviderCatalog {
  const stats = catalogStatsFromSnapshot(row.canonicalSnapshot);
  return {
    id: row.id,
    state: String(row.state),
    currentlyArchived: row.state === MenuVersionState.archived,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    ...stats,
  };
}

export function adoptionSourceLabel(source: CatalogAdoptionSource): "Square" | "Deliverect" | "other" {
  if (source === "square") return "Square";
  if (source === "deliverect") return "Deliverect";
  return "other";
}

export function providerAdoptionWouldMutate(input: {
  menuSourceAligned: boolean;
  selectedCurrentlyArchived: boolean;
  menuItemsThatWouldBeRestored: number;
}): boolean {
  return (
    !input.menuSourceAligned ||
    input.selectedCurrentlyArchived ||
    input.menuItemsThatWouldBeRestored > 0
  );
}

export { menuSourceProvider };

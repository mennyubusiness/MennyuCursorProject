import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { ExploreHero } from "@/components/explore/ExploreHero";
import { ExploreDiscovery } from "@/components/explore/ExploreDiscovery";
import { PageSection, PageShell } from "@/components/layout/page-shell";
import { mennyuCanonicalMenuSchema } from "@/domain/menu-import/canonical.schema";
import { MenuVersionState } from "@prisma/client";

function extractMenuCategoryNames(snapshot: unknown): string[] {
  const parsed = mennyuCanonicalMenuSchema.safeParse(snapshot);
  if (!parsed.success) return [];
  const names = parsed.data.categories
    .map((category) => category.name.trim())
    .filter((name) => name.length > 0);
  return Array.from(new Set(names));
}

export default async function ExplorePage() {
  const pods = await prisma.pod.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
    include: {
      vendors: {
        include: {
          vendor: {
            select: {
              id: true,
              slug: true,
              name: true,
              description: true,
              cuisineCategory: true,
              locationSummary: true,
              imageUrl: true,
              isActive: true,
              mennyuOrdersPaused: true,
              deletedAt: true,
            },
          },
        },
        where: { isActive: true, vendor: { isActive: true, deletedAt: null } },
        orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }],
      },
    },
  });

  const vendorIds = Array.from(
    new Set(
      pods.flatMap((pod) => pod.vendors.map((podVendor) => podVendor.vendor.id))
    )
  );

  const latestPublishedMenus = vendorIds.length
    ? await prisma.menuVersion.findMany({
        where: {
          vendorId: { in: vendorIds },
          state: MenuVersionState.published,
        },
        select: {
          vendorId: true,
          canonicalSnapshot: true,
          publishedAt: true,
          updatedAt: true,
        },
        orderBy: [{ vendorId: "asc" }, { publishedAt: "desc" }, { updatedAt: "desc" }],
      })
    : [];

  const vendorMenuCategoryMap = new Map<string, string[]>();
  for (const row of latestPublishedMenus) {
    if (vendorMenuCategoryMap.has(row.vendorId)) continue;
    vendorMenuCategoryMap.set(row.vendorId, extractMenuCategoryNames(row.canonicalSnapshot));
  }

  const podCards = pods.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    imageUrl: p.imageUrl,
    accentColor: p.accentColor,
    address: p.address,
    vendors: p.vendors.map((podVendor) => ({
      ...podVendor,
      vendor: {
        ...podVendor.vendor,
        menuCategoryNames: vendorMenuCategoryMap.get(podVendor.vendor.id) ?? [],
      },
    })),
  }));

  const featuredNames = podCards.slice(0, 4).map((p) => p.name);

  return (
    <div className="w-full bg-oo-cream">
      <ExploreHero featuredPodNames={featuredNames} />

      <PageSection className="!py-10 sm:!py-14">
        <PageShell>
          <Suspense
            fallback={
              <div className="space-y-8 py-8" aria-busy="true" aria-label="Loading explore">
                <div className="h-14 animate-pulse rounded-2xl bg-oo-light-stone/60" />
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="aspect-[4/3] animate-pulse rounded-xl bg-oo-light-stone/50" />
                  ))}
                </div>
              </div>
            }
          >
            <ExploreDiscovery pods={podCards} />
          </Suspense>
        </PageShell>
      </PageSection>
    </div>
  );
}

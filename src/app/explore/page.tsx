import { prisma } from "@/lib/db";
import { CustomerRetentionStrip } from "@/components/retention/CustomerRetentionStrip";
import { ExploreHero } from "@/components/explore/ExploreHero";
import { ExplorePopularPods } from "@/components/explore/ExplorePopularPods";
import { PageSection, PageShell } from "@/components/layout/page-shell";
import { ExplorePodList } from "./ExplorePodList";

export default async function ExplorePage() {
  const pods = await prisma.pod.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      vendors: {
        include: { vendor: { select: { id: true, name: true, description: true } } },
        where: { isActive: true },
        orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }],
      },
    },
  });

  const podCards = pods.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    imageUrl: p.imageUrl,
    accentColor: p.accentColor,
    vendors: p.vendors,
  }));

  const featuredNames = podCards.slice(0, 4).map((p) => p.name);

  return (
    <div className="w-full">
      <ExploreHero featuredPodNames={featuredNames} />

      <PageSection className="!py-12 sm:!py-16">
        <PageShell className="space-y-16 sm:space-y-20">
          <ExplorePopularPods pods={podCards} />

          <CustomerRetentionStrip
            className="border-oo-light-stone bg-oo-warm-white p-6 shadow-sm sm:p-8"
            heading="Continue browsing"
          />

          <section className="space-y-8" aria-labelledby="all-pods-heading">
            <div className="flex flex-col gap-3 border-b border-zinc-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 id="all-pods-heading" className="oo-section-title">
                  All pods
                </h2>
                <p className="mt-2 text-base text-zinc-600">
                  {podCards.length} active location{podCards.length === 1 ? "" : "s"} on the network
                </p>
              </div>
            </div>
            <ExplorePodList pods={podCards} />
          </section>
        </PageShell>
      </PageSection>
    </div>
  );
}

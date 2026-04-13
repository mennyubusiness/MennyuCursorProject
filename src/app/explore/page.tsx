import { prisma } from "@/lib/db";
import { CustomerRetentionStrip } from "@/components/retention/CustomerRetentionStrip";
import { ExploreHero } from "@/components/explore/ExploreHero";
import { ExplorePopularPods } from "@/components/explore/ExplorePopularPods";
import { ExplorePodList } from "./ExplorePodList";

export default async function ExplorePage() {
  const pods = await prisma.pod.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      vendors: {
        include: { vendor: { select: { name: true } } },
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
    <div className="space-y-10 rounded-2xl border border-stone-300/50 bg-gradient-to-b from-stone-200/50 to-stone-100/90 px-4 py-8 shadow-inner sm:px-6 sm:py-10">
      <ExploreHero featuredPodNames={featuredNames} />
      <ExplorePopularPods pods={podCards} />
      <CustomerRetentionStrip className="border-stone-300/80 bg-white shadow-md" heading="Continue browsing" />
      <section className="space-y-5" aria-labelledby="all-pods-heading">
        <h2 id="all-pods-heading" className="text-xl font-semibold tracking-tight text-stone-900 sm:text-2xl">
          All pods
        </h2>
        <ExplorePodList pods={podCards} />
      </section>
    </div>
  );
}

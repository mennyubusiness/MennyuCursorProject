import { prisma } from "@/lib/db";
import { CustomerRetentionStrip } from "@/components/retention/CustomerRetentionStrip";
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

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">Explore pods</h1>
        <p className="mt-2 max-w-xl text-stone-600">
          One trip to the pod — mix vendors, pay once, and pick up with a single code.
        </p>
      </header>
      <CustomerRetentionStrip className="mb-10" heading="Continue browsing" />
      <ExplorePodList
        pods={pods.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          imageUrl: p.imageUrl,
          accentColor: p.accentColor,
          vendors: p.vendors,
        }))}
      />
    </div>
  );
}

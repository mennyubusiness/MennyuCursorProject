import { prisma } from "@/lib/db";
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
          Pick a hub, mix vendors, and check out once — your order stays grouped for easy pickup.
        </p>
      </header>
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

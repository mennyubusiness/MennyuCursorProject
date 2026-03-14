import { prisma } from "@/lib/db";
import { ExplorePodList } from "./ExplorePodList";

export default async function ExplorePage() {
  const pods = await prisma.pod.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      vendors: {
        include: { vendor: true },
        where: { isActive: true },
      },
    },
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-stone-900">Explore pods</h1>
      <ExplorePodList
        pods={pods.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          vendors: p.vendors,
        }))}
      />
    </div>
  );
}

import { headers } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeJoinGroupSection } from "@/components/home/HomeJoinGroupSection";
import { HomeMarketingSections } from "@/components/home/HomeMarketingSections";
import { getCustomerSessionFromRequest } from "@/lib/customer-session";

export default async function HomePage() {
  const featuredPodsRaw = await prisma.pod.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    take: 5,
    include: {
      _count: {
        select: {
          vendors: { where: { isActive: true } },
        },
      },
    },
  });

  const featuredPods = featuredPodsRaw.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    imageUrl: p.imageUrl,
    vendorCount: p._count.vendors,
  }));

  const headersList = await headers();
  const customerSession = await getCustomerSessionFromRequest(headersList);

  return (
    <div className="w-full">
      <HomeHero featuredPods={featuredPods} />
      <HomeMarketingSections />
      <HomeJoinGroupSection customerAccountId={customerSession?.customerAccountId ?? null} />
    </div>
  );
}

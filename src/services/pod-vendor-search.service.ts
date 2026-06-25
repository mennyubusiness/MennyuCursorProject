import "server-only";

import { prisma } from "@/lib/db";

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 10;

export type PodVendorSearchResult = {
  id: string;
  name: string;
  slug: string;
  contactEmail: string | null;
  inAnotherPod: boolean;
  otherPodName: string | null;
};

export async function searchVendorsForPodInvite(
  podId: string,
  queryRaw: string
): Promise<{ ok: true; results: PodVendorSearchResult[] } | { ok: false; error: string }> {
  const query = queryRaw.trim();
  if (query.length < MIN_QUERY_LENGTH) {
    return { ok: false, error: `Enter at least ${MIN_QUERY_LENGTH} characters to search.` };
  }

  const vendorIdsInPod = (
    await prisma.podVendor.findMany({
      where: { podId },
      select: { vendorId: true },
    })
  ).map((row) => row.vendorId);

  const pendingTargetIds = (
    await prisma.podVendorInvite.findMany({
      where: { podId, status: "pending", expiresAt: { gt: new Date() } },
      select: { targetVendorId: true },
    })
  )
    .map((row) => row.targetVendorId)
    .filter((id): id is string => Boolean(id));

  const excludeIds = [...new Set([...vendorIdsInPod, ...pendingTargetIds])];

  const vendors = await prisma.vendor.findMany({
    where: {
      id: { notIn: excludeIds.length > 0 ? excludeIds : undefined },
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { slug: { contains: query, mode: "insensitive" } },
        { contactEmail: { contains: query, mode: "insensitive" } },
        { contactPhone: { contains: query, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      contactEmail: true,
      pods: {
        where: { podId: { not: podId } },
        select: { pod: { select: { name: true } } },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
    take: MAX_RESULTS,
  });

  return {
    ok: true,
    results: vendors.map((vendor) => ({
      id: vendor.id,
      name: vendor.name,
      slug: vendor.slug,
      contactEmail: vendor.contactEmail,
      inAnotherPod: vendor.pods.length > 0,
      otherPodName: vendor.pods[0]?.pod.name ?? null,
    })),
  };
}

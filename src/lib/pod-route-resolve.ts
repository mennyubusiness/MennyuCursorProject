import "server-only";

import { prisma } from "@/lib/db";
import { buildPodCustomerPath } from "@/lib/customer-public-url";

/** Prisma cuid-style ids used in legacy /pod/{id} routes. */
export function looksLikePodOrVendorId(ref: string): boolean {
  return /^c[a-z0-9]{20,}$/i.test(ref.trim());
}

export async function resolvePodBySlugOrId(ref: string) {
  const key = ref.trim();
  if (!key) return null;

  if (looksLikePodOrVendorId(key)) {
    return prisma.pod.findFirst({
      where: { OR: [{ id: key }, { slug: key }] },
      select: { id: true, slug: true, name: true, isActive: true },
    });
  }

  return prisma.pod.findUnique({
    where: { slug: key },
    select: { id: true, slug: true, name: true, isActive: true },
  });
}

export async function resolveVendorInPodBySlugOrId(podId: string, vendorRef: string) {
  const key = vendorRef.trim();
  if (!key) return null;

  const vendor = looksLikePodOrVendorId(key)
    ? await prisma.vendor.findFirst({
        where: { OR: [{ id: key }, { slug: key }] },
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          imageUrl: true,
          accentColor: true,
          cuisineCategory: true,
          isActive: true,
          mennyuOrdersPaused: true,
          deliverectChannelLinkId: true,
          syncCustomerOrderingHoursFromDeliverect: true,
          customerOrderingHours: true,
          deliverectSyncedCustomerOrderingHours: true,
        },
      })
    : await prisma.vendor.findUnique({
        where: { slug: key },
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          imageUrl: true,
          accentColor: true,
          cuisineCategory: true,
          isActive: true,
          mennyuOrdersPaused: true,
          deliverectChannelLinkId: true,
          syncCustomerOrderingHoursFromDeliverect: true,
          customerOrderingHours: true,
          deliverectSyncedCustomerOrderingHours: true,
        },
      });

  if (!vendor) return null;

  const podVendor = await prisma.podVendor.findUnique({
    where: { podId_vendorId: { podId, vendorId: vendor.id } },
    select: { isActive: true },
  });

  if (!podVendor) return null;
  return { vendor, podVendor };
}

/** Canonical customer path for a pod id (falls back to legacy /pod/{id}). */
export async function getPodCustomerPathForPodId(podId: string): Promise<string> {
  const pod = await prisma.pod.findUnique({ where: { id: podId }, select: { slug: true } });
  return pod ? buildPodCustomerPath(pod.slug) : `/pod/${podId}`;
}

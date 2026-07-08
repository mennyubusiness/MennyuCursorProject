import "server-only";

import { revalidatePath } from "next/cache";
import { buildPodCustomerPath, buildVendorMenuCustomerPath } from "@/lib/customer-public-url";
import { prisma } from "@/lib/db";
import { revalidateOperationalMenuCacheForVendor } from "@/services/menu-active-scope.service";
import { revalidateCustomerVendorMenuCacheForVendor } from "@/services/vendor-customer-menu-cache.service";

/** Revalidate vendor workspace, pod owner tools, and customer-facing pages after pod membership changes. */
export async function revalidateVendorPodMembershipSurfaces(input: {
  vendorId: string;
  podIds: string[];
}): Promise<void> {
  const uniquePodIds = [...new Set(input.podIds.filter(Boolean))];
  const vendorId = input.vendorId.trim();
  if (!vendorId) return;

  revalidatePath(`/vendor/${vendorId}/settings`);
  revalidatePath(`/vendor/${vendorId}/dashboard`);
  revalidatePath(`/vendor/${vendorId}/setup`);
  revalidatePath(`/vendor/${vendorId}/orders`);
  revalidatePath(`/vendor/${vendorId}/kitchen`);
  revalidatePath(`/vendor/${vendorId}/menu`);
  revalidatePath(`/vendor/${vendorId}/menu-builder`);
  revalidatePath(`/vendor/${vendorId}/hours`);
  revalidatePath(`/admin/vendors/${vendorId}`);
  revalidatePath("/explore");

  revalidateOperationalMenuCacheForVendor(vendorId);
  revalidateCustomerVendorMenuCacheForVendor(vendorId);

  if (uniquePodIds.length === 0) return;

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { slug: true },
  });

  const pods = await prisma.pod.findMany({
    where: { id: { in: uniquePodIds } },
    select: { id: true, slug: true },
  });

  for (const pod of pods) {
    revalidatePath(`/pod/${pod.id}/dashboard`);
    revalidatePath(`/pod/${pod.id}/vendors`);
    revalidatePath(`/pod/${pod.id}/setup`);
    revalidatePath(`/admin/pods/${pod.id}`);
    if (pod.slug) {
      revalidatePath(buildPodCustomerPath(pod.slug));
      if (vendor?.slug) {
        revalidatePath(buildVendorMenuCustomerPath(pod.slug, vendor.slug));
      }
    }
    revalidatePath(`/pod/${pod.id}/vendor/${vendorId}`);
  }
}

/** Revalidate customer-facing pod/vendor pages and caches after orderability-affecting changes. */
export async function revalidateVendorCustomerOrderingSurfaces(vendorId: string): Promise<void> {
  const id = vendorId.trim();
  if (!id) return;

  revalidatePath(`/vendor/${id}/dashboard`);
  revalidatePath(`/vendor/${id}/setup`);
  revalidatePath("/explore");

  revalidateOperationalMenuCacheForVendor(id);
  revalidateCustomerVendorMenuCacheForVendor(id);

  const [vendor, memberships] = await Promise.all([
    prisma.vendor.findUnique({ where: { id }, select: { slug: true } }),
    prisma.podVendor.findMany({
      where: { vendorId: id },
      select: { pod: { select: { id: true, slug: true } } },
    }),
  ]);

  for (const membership of memberships) {
    const pod = membership.pod;
    revalidatePath(`/pod/${pod.id}/dashboard`);
    revalidatePath(`/pod/${pod.id}/vendors`);
    if (pod.slug) {
      revalidatePath(buildPodCustomerPath(pod.slug));
      if (vendor?.slug) {
        revalidatePath(buildVendorMenuCustomerPath(pod.slug, vendor.slug));
      }
    }
    revalidatePath(`/pod/${pod.id}/vendor/${id}`);
  }
}

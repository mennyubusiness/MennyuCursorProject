import { notFound, permanentRedirect } from "next/navigation";

import { buildVendorMenuCustomerPath } from "@/lib/customer-public-url";
import { resolvePodBySlugOrId, resolveVendorInPodBySlugOrId } from "@/lib/pod-route-resolve";

export default async function LegacyVendorMenuRedirectPage({
  params,
}: {
  params: Promise<{ podId: string; vendorId: string }>;
}) {
  const { podId, vendorId } = await params;
  const pod = await resolvePodBySlugOrId(podId);
  if (!pod?.isActive) notFound();

  const resolved = await resolveVendorInPodBySlugOrId(pod.id, vendorId);
  if (!resolved?.vendor.isActive) notFound();

  permanentRedirect(buildVendorMenuCustomerPath(pod.slug, resolved.vendor.slug));
}

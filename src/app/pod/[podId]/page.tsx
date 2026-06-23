import { notFound, permanentRedirect } from "next/navigation";

import { buildPodCustomerPath } from "@/lib/customer-public-url";
import { POD_QR_ENTRY_VALUE } from "@/lib/pod-ordering-url";
import { resolvePodBySlugOrId } from "@/lib/pod-route-resolve";

export default async function LegacyPodIdRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ podId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { podId } = await params;
  const sp = await searchParams;
  const pod = await resolvePodBySlugOrId(podId);
  if (!pod?.isActive) notFound();

  const qs = new URLSearchParams();
  const entryRaw = sp.entry;
  const entry = Array.isArray(entryRaw) ? entryRaw[0] : entryRaw;
  if (entry === POD_QR_ENTRY_VALUE) qs.set("entry", POD_QR_ENTRY_VALUE);
  const highlightVendorRaw = sp.highlightVendor;
  const highlightVendor = (Array.isArray(highlightVendorRaw) ? highlightVendorRaw[0] : highlightVendorRaw)?.trim();
  if (highlightVendor) qs.set("highlightVendor", highlightVendor);
  const variantRaw = sp.variant;
  const variantParam = (Array.isArray(variantRaw) ? variantRaw[0] : variantRaw) ?? null;
  if (variantParam) qs.set("variant", variantParam);

  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  permanentRedirect(`${buildPodCustomerPath(pod.slug)}${suffix}`);
}

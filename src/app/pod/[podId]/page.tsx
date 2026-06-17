import { notFound } from "next/navigation";

import { DestinationPodPageView } from "@/components/pod/destination/DestinationPodPageView";
import { StandardPodPageView } from "@/components/pod/StandardPodPageView";
import { POD_QR_ENTRY_VALUE } from "@/lib/pod-ordering-url";
import { loadPodCustomerPageData } from "@/lib/pod-customer-page-data";
import { isDestinationPodPage } from "@/lib/pod-page-variant";

export default async function PodPage({
  params,
  searchParams,
}: {
  params: Promise<{ podId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { podId } = await params;
  const sp = await searchParams;
  const entryRaw = sp.entry;
  const entry = Array.isArray(entryRaw) ? entryRaw[0] : entryRaw;
  const isQrEntry = entry === POD_QR_ENTRY_VALUE;
  const highlightVendorRaw = sp.highlightVendor;
  const highlightVendor =
    (Array.isArray(highlightVendorRaw) ? highlightVendorRaw[0] : highlightVendorRaw)?.trim() ?? null;
  const variantRaw = sp.variant;
  const variantParam = (Array.isArray(variantRaw) ? variantRaw[0] : variantRaw) ?? null;

  const data = await loadPodCustomerPageData(podId);
  if (!data) notFound();

  const viewProps = {
    ...data,
    isQrEntry,
    highlightVendor,
  };

  if (
    isDestinationPodPage({
      podId: data.pod.id,
      podSlug: data.pod.slug,
      variantParam,
    })
  ) {
    return <DestinationPodPageView {...viewProps} />;
  }

  return <StandardPodPageView {...viewProps} />;
}

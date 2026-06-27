import { notFound, redirect } from "next/navigation";

import { DestinationPodPageView } from "@/components/pod/destination/DestinationPodPageView";
import { StandardPodPageView } from "@/components/pod/StandardPodPageView";
import { POD_QR_ENTRY_VALUE } from "@/lib/pod-ordering-url";
import { loadPodCustomerPageData } from "@/lib/pod-customer-page-data";
import { resolvePodPageTemplate } from "@/lib/pod-page-variant";
import { looksLikePodOrVendorId, resolvePodBySlugOrId } from "@/lib/pod-route-resolve";
import { findSlugRedirectByOldSlug } from "@/lib/slug-admin.server";
import { buildPodCustomerPath } from "@/lib/customer-public-url";

export async function renderPodCustomerPage(
  podRef: string,
  searchParams: Record<string, string | string[] | undefined>
) {
  const slugRedirect = await findSlugRedirectByOldSlug(podRef);
  if (slugRedirect?.entityType === "pod") {
    const entryRaw = searchParams.entry;
    const entry = Array.isArray(entryRaw) ? entryRaw[0] : entryRaw;
    const qs = new URLSearchParams();
    if (entry === POD_QR_ENTRY_VALUE) qs.set("entry", POD_QR_ENTRY_VALUE);
    const highlightVendorRaw = searchParams.highlightVendor;
    const highlightVendor = (Array.isArray(highlightVendorRaw) ? highlightVendorRaw[0] : highlightVendorRaw)?.trim();
    if (highlightVendor) qs.set("highlightVendor", highlightVendor);
    const variantRaw = searchParams.variant;
    const variantParam = (Array.isArray(variantRaw) ? variantRaw[0] : variantRaw) ?? null;
    if (variantParam) qs.set("variant", variantParam);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    redirect(`${buildPodCustomerPath(slugRedirect.newSlug)}${suffix}`);
  }

  const resolved = await resolvePodBySlugOrId(podRef);
  if (!resolved?.isActive) notFound();

  if (looksLikePodOrVendorId(podRef) && podRef !== resolved.slug) {
    const entryRaw = searchParams.entry;
    const entry = Array.isArray(entryRaw) ? entryRaw[0] : entryRaw;
    const qs = new URLSearchParams();
    if (entry === POD_QR_ENTRY_VALUE) {
      qs.set("entry", POD_QR_ENTRY_VALUE);
    }
    const highlightVendorRaw = searchParams.highlightVendor;
    const highlightVendor = (Array.isArray(highlightVendorRaw) ? highlightVendorRaw[0] : highlightVendorRaw)?.trim();
    if (highlightVendor) qs.set("highlightVendor", highlightVendor);
    const variantRaw = searchParams.variant;
    const variantParam = (Array.isArray(variantRaw) ? variantRaw[0] : variantRaw) ?? null;
    if (variantParam) qs.set("variant", variantParam);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    redirect(`${buildPodCustomerPath(resolved.slug)}${suffix}`);
  }

  const entryRaw = searchParams.entry;
  const entry = Array.isArray(entryRaw) ? entryRaw[0] : entryRaw;
  const isQrEntry = entry === POD_QR_ENTRY_VALUE;
  const highlightVendorRaw = searchParams.highlightVendor;
  const highlightVendor =
    (Array.isArray(highlightVendorRaw) ? highlightVendorRaw[0] : highlightVendorRaw)?.trim() ?? null;
  const variantRaw = searchParams.variant;
  const variantParam = (Array.isArray(variantRaw) ? variantRaw[0] : variantRaw) ?? null;

  const data = await loadPodCustomerPageData(resolved.id);
  if (!data) notFound();

  const viewProps = {
    ...data,
    isQrEntry,
    highlightVendor,
  };

  const template = resolvePodPageTemplate({
    podId: data.pod.id,
    podSlug: data.pod.slug,
    variantParam,
  });

  if (template === "destination") {
    return <DestinationPodPageView {...viewProps} />;
  }

  return <StandardPodPageView {...viewProps} />;
}

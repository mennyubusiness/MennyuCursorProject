import { notFound, redirect } from "next/navigation";

import { RecentVendorViewTracker } from "@/components/retention/RecentViewTracker";
import { VendorMenuExperience } from "@/components/vendor-menu/VendorMenuExperience";
import { VendorMenuHero } from "@/components/vendor-menu/VendorMenuHero";
import { getOrCreateCartForVendorMenuAction } from "@/actions/cart.actions";
import { buildVendorMenuCustomerPath } from "@/lib/customer-public-url";
import { prisma } from "@/lib/db";
import { looksLikePodOrVendorId, resolvePodBySlugOrId, resolveVendorInPodBySlugOrId } from "@/lib/pod-route-resolve";
import { findSlugRedirectByOldSlug } from "@/lib/slug-admin.server";
import { getVendorOrderabilityInPod } from "@/lib/vendor-orderability-in-pod";
import {
  getVendorPublicVisibilityState,
  getVendorOrderabilityState,
} from "@/lib/vendor-readiness-states";
import { loadVendorReadinessBundles } from "@/lib/vendor-readiness-validation.server";
import {
  resolveVendorHoursTimezone,
  vendorAvailabilityWithCustomerOrderingHours,
} from "@/lib/vendor-customer-ordering-hours";
import { buildVendorHoursDisplay } from "@/lib/vendor-hours-display";
import { loadCustomerVendorMenuSections } from "@/services/vendor-customer-menu.service";

const DEBUG_VENDOR_MENU_PAGE = process.env.NODE_ENV === "development";

export async function renderVendorMenuCustomerPage(podRef: string, vendorRef: string) {
  const podSlugRedirect = await findSlugRedirectByOldSlug(podRef);
  if (podSlugRedirect?.entityType === "pod") {
    redirect(buildVendorMenuCustomerPath(podSlugRedirect.newSlug, vendorRef));
  }

  const vendorSlugRedirect = await findSlugRedirectByOldSlug(vendorRef);
  const resolvedVendorRef =
    vendorSlugRedirect?.entityType === "vendor" ? vendorSlugRedirect.newSlug : vendorRef;

  const pod = await resolvePodBySlugOrId(podRef);
  if (!pod?.isActive) notFound();

  const resolved = await resolveVendorInPodBySlugOrId(pod.id, resolvedVendorRef);
  if (!resolved) notFound();

  const { vendor, podVendor: pv } = resolved;
  if (!vendor.isActive || !pv?.isActive) notFound();

  const readinessBundles = await loadVendorReadinessBundles([vendor.id]);
  const readinessBundle = readinessBundles.get(vendor.id);
  if (!readinessBundle) notFound();

  const readinessEvaluation = {
    vendor: readinessBundle.vendor,
    menuSummary: readinessBundle.menuSummary,
    stripeSummary: readinessBundle.stripeSummary,
    posSummary: readinessBundle.posSummary,
    pod: { isActive: true, mennyuOrdersPaused: false },
    podVendor: { exists: true, isActive: pv.isActive },
  };

  if (getVendorPublicVisibilityState(readinessEvaluation) === "hidden") {
    notFound();
  }

  if (
    (looksLikePodOrVendorId(podRef) && podRef !== pod.slug) ||
    (looksLikePodOrVendorId(vendorRef) && vendorRef !== vendor.slug) ||
    (vendorSlugRedirect && vendorRef !== vendor.slug)
  ) {
    redirect(buildVendorMenuCustomerPath(pod.slug, vendor.slug));
  }

  const podId = pod.id;
  const vendorId = vendor.id;

  const pageStarted = DEBUG_VENDOR_MENU_PAGE ? Date.now() : 0;
  const menuStarted = DEBUG_VENDOR_MENU_PAGE ? Date.now() : 0;
  const cartStarted = DEBUG_VENDOR_MENU_PAGE ? Date.now() : 0;

  const podRow = await prisma.pod.findUnique({
    where: { id: podId },
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      mennyuOrdersPaused: true,
      accentColor: true,
      pickupTimezone: true,
    },
  });
  if (!podRow?.isActive) notFound();

  const [{ sections, variantChildCountByParentPlu }, cart] = await Promise.all([
    loadCustomerVendorMenuSections(vendorId),
    getOrCreateCartForVendorMenuAction(podId),
  ]);

  if (DEBUG_VENDOR_MENU_PAGE) {
    console.info("[vendor-menu-page] load timing", {
      vendorId,
      podId,
      menuMs: Date.now() - menuStarted,
      cartMs: Date.now() - cartStarted,
      totalMs: Date.now() - pageStarted,
      sectionCount: sections.length,
      cartItemCount: cart.items.length,
    });
  }

  const vendorForOrderability = vendorAvailabilityWithCustomerOrderingHours(
    vendor,
    podRow.pickupTimezone
  );
  const evaluationWithAvailability = {
    ...readinessEvaluation,
    pod: { isActive: podRow.isActive, mennyuOrdersPaused: podRow.mennyuOrdersPaused },
    vendorAvailability: vendorForOrderability,
  };

  const orderability = getVendorOrderabilityInPod({
    podActive: podRow.isActive,
    podOrdersPaused: podRow.mennyuOrdersPaused,
    podVendorExists: Boolean(pv),
    podVendorActive: pv?.isActive ?? false,
    vendor: vendorForOrderability,
    readiness: {
      vendor: readinessBundle.vendor,
      menuSummary: readinessBundle.menuSummary,
      stripeSummary: readinessBundle.stripeSummary,
      posSummary: readinessBundle.posSummary,
    },
  });
  const orderState = getVendorOrderabilityState(evaluationWithAvailability);
  const orderingDisabled = !orderability.orderable;
  const bannerLine = orderingDisabled ? orderState.customerBannerLine : null;
  const availabilityStatus = orderingDisabled
    ? orderState.customerStatusLabel === "Closed right now"
      ? ("closed" as const)
      : orderState.customerStatusLabel === "Not accepting orders right now"
        ? ("mennyu_paused" as const)
        : ("inactive" as const)
    : ("open" as const);

  const hoursDisplay = buildVendorHoursDisplay({
    customerOrderingHours: vendor.customerOrderingHours,
    timeZone: resolveVendorHoursTimezone(podRow.pickupTimezone),
  });

  return (
    <div className="w-full min-h-0">
      <RecentVendorViewTracker
        vendorId={vendorId}
        podId={podId}
        podSlug={podRow.slug}
        vendorSlug={vendor.slug}
        vendorName={vendor.name}
      />

      <VendorMenuHero
        podId={podId}
        podSlug={podRow.slug}
        podName={podRow.name}
        podAccentColor={podRow.accentColor}
        vendorId={vendorId}
        vendorName={vendor.name}
        vendorDescription={vendor.description}
        vendorImageUrl={vendor.imageUrl}
        vendorAccentColor={vendor.accentColor}
        cuisineCategory={vendor.cuisineCategory}
        availabilityStatus={availabilityStatus}
        bannerLine={bannerLine}
        hoursDisplay={hoursDisplay}
      />

      {sections.length === 0 ? (
        <div className="oo-shell py-12">
          <div className="oo-empty-state">
            <p className="font-medium text-zinc-900">This vendor has no menu items available right now.</p>
            <p className="mt-2 text-sm text-zinc-600">Check back later or browse other kitchens at {podRow.name}.</p>
          </div>
        </div>
      ) : (
        <VendorMenuExperience
          podId={podId}
          podSlug={podRow.slug}
          podName={podRow.name}
          vendorId={vendorId}
          vendorSlug={vendor.slug}
          vendorName={vendor.name}
          vendorAccentColor={vendor.accentColor}
          sections={sections}
          variantChildCountByParentPlu={variantChildCountByParentPlu}
          cart={cart}
          orderingDisabled={orderingDisabled}
          vendorUsesDeliverect={Boolean(vendor.deliverectChannelLinkId?.trim())}
        />
      )}
    </div>
  );
}

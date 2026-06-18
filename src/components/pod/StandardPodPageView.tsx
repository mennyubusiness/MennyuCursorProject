import { RecentPodViewTracker } from "@/components/retention/RecentViewTracker";
import { PodPageHero } from "@/components/pod/PodPageHero";
import { PodPageIdentitySection } from "@/components/pod/PodPageIdentitySection";
import { PodPageContactSection } from "@/components/pod/PodPageContactSection";
import { PodPageLocationSection } from "@/components/pod/PodPageLocationSection";
import { PodPageStickyNav } from "@/components/pod/PodPageStickyNav";
import { PodPageStickyCta } from "@/components/pod/PodPageStickyCta";
import { PodPageVendorSection } from "@/components/pod/PodPageVendorSection";
import { ScrollPodVendorIntoView } from "@/components/pod/ScrollPodVendorIntoView";
import { PageShell } from "@/components/layout/page-shell";
import type { PodCustomerPageData } from "@/lib/pod-customer-page-data";

/** Legacy/classic pod page template. Destination is the current default. */
type StandardPodPageViewProps = PodCustomerPageData & {
  isQrEntry: boolean;
  highlightVendor: string | null;
};

export function StandardPodPageView({
  pod,
  vendorRows,
  amenities,
  orderingStatus,
  hasLocationSection,
  hasContactSection,
  hasAboutSection,
  contactDetails,
  groupOrderHref,
  navItems,
  isQrEntry,
  highlightVendor,
}: StandardPodPageViewProps) {
  const podId = pod.id;

  return (
    <div className="w-full min-h-0 pb-20 lg:pb-0">
      <RecentPodViewTracker podId={pod.id} podName={pod.name} />

      <PodPageHero
        podId={podId}
        name={pod.name}
        tagline={pod.tagline}
        description={pod.description}
        address={pod.address}
        imageUrl={pod.imageUrl}
        accentColor={pod.accentColor}
        orderingStatus={orderingStatus}
        hasVendors={vendorRows.length > 0}
      />

      <PodPageStickyNav items={navItems} podId={pod.id} podName={pod.name} />

      {isQrEntry && (
        <PageShell className="py-4">
          <div
            className="rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 text-sm text-oo-charcoal"
            role="status"
          >
            <p className="font-semibold">You&apos;re ordering from {pod.name}</p>
            <p className="mt-0.5 text-oo-stone-gray">
              Pick a vendor below — one cart, one checkout, one pickup.
            </p>
          </div>
        </PageShell>
      )}

      <ScrollPodVendorIntoView vendorId={highlightVendor} />

      <PodPageVendorSection
        podId={podId}
        podName={pod.name}
        rows={vendorRows}
        highlightVendorId={highlightVendor}
        orderingStatus={orderingStatus}
        showContactLink={hasLocationSection || hasContactSection}
        contactAnchorId={
          hasLocationSection ? "pod-location" : hasContactSection ? "pod-contact" : null
        }
      />

      {hasAboutSection && (
        <PodPageIdentitySection
          podName={pod.name}
          tagline={pod.tagline}
          description={pod.description}
          amenities={amenities}
        />
      )}

      {hasLocationSection && pod.address && (
        <PodPageLocationSection
          podName={pod.name}
          address={pod.address}
          pickupInstructions={pod.pickupInstructions}
        />
      )}

      {hasContactSection && <PodPageContactSection contact={contactDetails} />}

      <PodPageStickyCta
        podName={pod.name}
        showVendorsCta={vendorRows.length > 0}
        showGroupOrderCta={vendorRows.length > 0}
        groupOrderHref={groupOrderHref}
      />
    </div>
  );
}

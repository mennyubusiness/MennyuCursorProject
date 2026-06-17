import { RecentPodViewTracker } from "@/components/retention/RecentViewTracker";
import { DestinationPodAboutSection } from "@/components/pod/destination/DestinationPodAboutSection";
import { DestinationPodGroupOrderSection } from "@/components/pod/destination/DestinationPodGroupOrderSection";
import { DestinationPodHero } from "@/components/pod/destination/DestinationPodHero";
import { DestinationPodVendorSection } from "@/components/pod/destination/DestinationPodVendorSection";
import { DestinationPodVisitSection } from "@/components/pod/destination/DestinationPodVisitSection";
import { PodPageStickyNav } from "@/components/pod/PodPageStickyNav";
import { PodPageStickyCta } from "@/components/pod/PodPageStickyCta";
import { ScrollPodVendorIntoView } from "@/components/pod/ScrollPodVendorIntoView";
import { PageShell } from "@/components/layout/page-shell";
import type { PodCustomerPageData } from "@/lib/pod-customer-page-data";
import { buildDestinationMarqueeItems } from "@/lib/pod-destination-marquee";
import { buildDestinationPodNavItems } from "@/lib/pod-page-nav";

type DestinationPodPageViewProps = PodCustomerPageData & {
  isQrEntry: boolean;
  highlightVendor: string | null;
};

export function DestinationPodPageView({
  pod,
  vendorRows,
  amenities,
  orderingStatus,
  hasAboutSection,
  hasVisitSection,
  contactDetails,
  groupOrderHref,
  isQrEntry,
  highlightVendor,
}: DestinationPodPageViewProps) {
  const podId = pod.id;
  const hasVendors = vendorRows.length > 0;
  const marqueeItems = buildDestinationMarqueeItems({
    orderingStatus,
    vendorCount: vendorRows.length,
    amenities,
  });

  const destinationAbout =
    hasAboutSection ||
    Boolean(pod.ownerContactName?.trim()) ||
    amenities.length > 0;

  const navItems = buildDestinationPodNavItems({
    hasAboutSection: destinationAbout,
    hasVisitSection,
    hasGroupOrderSection: hasVendors,
  });

  return (
    <div className="w-full min-h-0 pb-20 lg:pb-0">
      <RecentPodViewTracker podId={pod.id} podName={pod.name} />

      <DestinationPodHero
        podId={podId}
        name={pod.name}
        tagline={pod.tagline}
        description={pod.description}
        address={pod.address}
        imageUrl={pod.imageUrl}
        accentColor={pod.accentColor}
        orderingStatus={orderingStatus}
        hasVendors={hasVendors}
        marqueeItems={marqueeItems}
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

      <DestinationPodVendorSection
        podId={podId}
        podName={pod.name}
        rows={vendorRows}
        highlightVendorId={highlightVendor}
        orderingStatus={orderingStatus}
        showContactLink={hasVisitSection}
        contactAnchorId={hasVisitSection ? "pod-visit" : null}
      />

      {hasVendors && <DestinationPodGroupOrderSection podId={podId} />}

      {destinationAbout && (
        <DestinationPodAboutSection
          podName={pod.name}
          tagline={pod.tagline}
          description={pod.description}
          ownerContactName={pod.ownerContactName}
          address={pod.address}
          amenities={amenities}
        />
      )}

      {hasVisitSection && (
        <DestinationPodVisitSection
          podName={pod.name}
          address={pod.address}
          pickupInstructions={pod.pickupInstructions}
          contact={contactDetails}
        />
      )}

      <PodPageStickyCta
        podName={pod.name}
        showVendorsCta={hasVendors}
        showGroupOrderCta={hasVendors}
        groupOrderHref={groupOrderHref}
        primaryLabel="Start order"
      />
    </div>
  );
}

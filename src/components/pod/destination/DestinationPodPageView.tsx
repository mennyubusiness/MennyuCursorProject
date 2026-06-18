import { RecentPodViewTracker } from "@/components/retention/RecentViewTracker";
import { DestinationPodAboutSection } from "@/components/pod/destination/DestinationPodAboutSection";
import { DestinationPodGroupOrderNavActions } from "@/components/pod/destination/DestinationPodGroupOrderNavActions";
import { DestinationPodHero } from "@/components/pod/destination/DestinationPodHero";
import { DestinationPodVendorSection } from "@/components/pod/destination/DestinationPodVendorSection";
import { PodPageStickyNav } from "@/components/pod/PodPageStickyNav";
import { ScrollPodVendorIntoView } from "@/components/pod/ScrollPodVendorIntoView";
import { PageShell } from "@/components/layout/page-shell";
import type { PodCustomerPageData } from "@/lib/pod-customer-page-data";
import { buildDestinationMarqueeContent } from "@/lib/pod-destination-marquee";
import { buildDestinationPodNavItems } from "@/lib/pod-page-nav";

type DestinationPodPageViewProps = PodCustomerPageData & {
  isQrEntry: boolean;
  highlightVendor: string | null;
};

export function DestinationPodPageView({
  pod,
  vendorRows,
  amenities,
  customAmenities,
  orderingStatus,
  hasVisitSection,
  contactDetails,
  isQrEntry,
  highlightVendor,
}: DestinationPodPageViewProps) {
  const podId = pod.id;
  const hasVendors = vendorRows.length > 0;
  const hasAmenities = amenities.length > 0 || customAmenities.length > 0;
  const hasDestinationAboutSection =
    hasVisitSection ||
    hasAmenities ||
    Boolean(pod.description?.trim() || pod.ownerContactName?.trim());
  const marqueeItems = buildDestinationMarqueeContent({
    podName: pod.name,
    vendorNames: vendorRows.map((row) => row.vendor.name),
  }).items;

  const navItems = buildDestinationPodNavItems({
    hasAboutSection: hasDestinationAboutSection,
  });

  return (
    <div className="w-full min-h-0">
      <RecentPodViewTracker podId={pod.id} podName={pod.name} />

      <DestinationPodHero
        name={pod.name}
        tagline={pod.tagline}
        imageUrl={pod.imageUrl}
        accentColor={pod.accentColor}
        marqueeItems={marqueeItems}
      />

      <PodPageStickyNav
        items={navItems}
        podId={pod.id}
        podName={pod.name}
        trailingActions={
          hasVendors ? <DestinationPodGroupOrderNavActions podId={podId} /> : undefined
        }
      />

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
        showContactLink={hasDestinationAboutSection}
        contactAnchorId={hasDestinationAboutSection ? "pod-about" : null}
      />

      {hasDestinationAboutSection && (
        <DestinationPodAboutSection
          podName={pod.name}
          description={pod.description}
          ownerContactName={pod.ownerContactName}
          address={pod.address}
          pickupInstructions={pod.pickupInstructions}
          amenities={amenities}
          customAmenities={customAmenities}
          contact={contactDetails}
        />
      )}
    </div>
  );
}

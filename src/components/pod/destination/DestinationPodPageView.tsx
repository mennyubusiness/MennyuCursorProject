import { RecentPodViewTracker } from "@/components/retention/RecentViewTracker";
import { DestinationPodAboutSection } from "@/components/pod/destination/DestinationPodAboutSection";
import { DestinationPodGroupOrderPromptGate } from "@/components/pod/destination/DestinationPodGroupOrderPromptGate";
import { DestinationPodHero } from "@/components/pod/destination/DestinationPodHero";
import { DestinationPodStickyNav } from "@/components/pod/destination/DestinationPodStickyNav";
import { DestinationPodVendorSection } from "@/components/pod/destination/DestinationPodVendorSection";
import { PodAnnouncementBanner } from "@/components/pod/PodAnnouncementBanner";
import { ScrollPodVendorIntoView } from "@/components/pod/ScrollPodVendorIntoView";
import { PageShell } from "@/components/layout/page-shell";
import type { PodCustomerPageData } from "@/lib/pod-customer-page-data";
import { buildDestinationMarqueeContent } from "@/lib/pod-destination-marquee";
import { buildDestinationPodNavItems } from "@/lib/pod-page-nav";

type DestinationPodPageViewProps = PodCustomerPageData & {
  isQrEntry: boolean;
  hasExplicitJoinIntent: boolean;
  highlightVendor: string | null;
};

export function DestinationPodPageView({
  pod,
  activeAnnouncement,
  vendorRows,
  amenities,
  customAmenities,
  orderingStatus,
  hasOrderableVendor,
  hasVisitSection,
  contactDetails,
  isQrEntry,
  hasExplicitJoinIntent,
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
      <RecentPodViewTracker podId={pod.id} podSlug={pod.slug} podName={pod.name} />

      <DestinationPodHero
        name={pod.name}
        tagline={pod.tagline}
        imageUrl={pod.imageUrl}
        accentColor={pod.accentColor}
        marqueeItems={marqueeItems}
      />

      <DestinationPodStickyNav items={navItems} podId={pod.id} podName={pod.name} />

      <DestinationPodGroupOrderPromptGate
        podId={podId}
        hasVendors={hasVendors}
        isQrEntry={isQrEntry}
        hasExplicitJoinIntent={hasExplicitJoinIntent}
        orderingStatus={orderingStatus}
      />

      {isQrEntry && (
        <PageShell className="py-4">
          <div
            className="rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 text-sm text-oo-charcoal"
            role="status"
          >
            {hasOrderableVendor ? (
              <>
                <p className="font-semibold">You&apos;re ordering from {pod.name}</p>
                <p className="mt-0.5 text-oo-stone-gray">
                  Pick a vendor below — one cart, one checkout, one pickup.
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold">Welcome to {pod.name}</p>
                <p className="mt-0.5 text-oo-stone-gray">
                  Browse the menus below to see what each kitchen is serving.
                </p>
              </>
            )}
          </div>
        </PageShell>
      )}

      <ScrollPodVendorIntoView vendorId={highlightVendor} />

      {activeAnnouncement ? <PodAnnouncementBanner text={activeAnnouncement} /> : null}

      <DestinationPodVendorSection
        podSlug={pod.slug}
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

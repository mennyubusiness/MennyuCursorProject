import { RecentPodViewTracker } from "@/components/retention/RecentViewTracker";
import { DestinationPodAboutSection } from "@/components/pod/destination/DestinationPodAboutSection";
import { DestinationPodGroupOrderPromptGate } from "@/components/pod/destination/DestinationPodGroupOrderPromptGate";
import { DestinationPodHero } from "@/components/pod/destination/DestinationPodHero";
import { DestinationPodStickyNav } from "@/components/pod/destination/DestinationPodStickyNav";
import { DestinationPodVendorSection } from "@/components/pod/destination/DestinationPodVendorSection";
import { PodAnnouncementBanner } from "@/components/pod/PodAnnouncementBanner";
import { PodQrEntryBanner } from "@/components/pod/PodQrEntryBanner";
import { ScrollPodVendorIntoView } from "@/components/pod/ScrollPodVendorIntoView";
import type { PodCustomerPageData } from "@/lib/pod-customer-page-data";
import { buildDestinationMarqueeContent } from "@/lib/pod-destination-marquee";
import { buildDestinationPodNavItems } from "@/lib/pod-page-nav";

type DestinationPodPageViewProps = PodCustomerPageData & {
  isQrEntry: boolean;
  highlightVendor: string | null;
};

export function DestinationPodPageView({
  pod,
  activeAnnouncement,
  vendorRows,
  amenities,
  customAmenities,
  orderingStatus,
  hasVisitSection,
  contactDetails,
  groupOrderHref,
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

  const announcementBlock =
    activeAnnouncement != null ? (
      <PodAnnouncementBanner text={activeAnnouncement} compact={isQrEntry} />
    ) : null;

  return (
    <div className="w-full min-h-0">
      <RecentPodViewTracker podId={pod.id} podSlug={pod.slug} podName={pod.name} />

      <DestinationPodHero
        name={pod.name}
        tagline={pod.tagline}
        imageUrl={pod.imageUrl}
        accentColor={pod.accentColor}
        marqueeItems={marqueeItems}
        isQrEntry={isQrEntry}
      />

      {isQrEntry ? <PodQrEntryBanner podName={pod.name} /> : null}

      <DestinationPodStickyNav items={navItems} podId={pod.id} podName={pod.name} />

      <DestinationPodGroupOrderPromptGate
        podId={podId}
        hasVendors={hasVendors}
        isQrEntry={isQrEntry}
        orderingStatus={orderingStatus}
      />

      <ScrollPodVendorIntoView vendorId={highlightVendor} />

      {!isQrEntry ? announcementBlock : null}

      <DestinationPodVendorSection
        podSlug={pod.slug}
        podName={pod.name}
        rows={vendorRows}
        highlightVendorId={highlightVendor}
        orderingStatus={orderingStatus}
        showContactLink={hasDestinationAboutSection}
        contactAnchorId={hasDestinationAboutSection ? "pod-about" : null}
        groupOrderHref={hasVendors ? groupOrderHref : null}
        pickupAddress={pod.address}
      />

      {isQrEntry ? announcementBlock : null}

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

import { RecentPodViewTracker } from "@/components/retention/RecentViewTracker";
import { PodPageHero } from "@/components/pod/PodPageHero";
import { PodPageIdentitySection } from "@/components/pod/PodPageIdentitySection";
import { PodPageContactSection } from "@/components/pod/PodPageContactSection";
import { PodPageLocationSection } from "@/components/pod/PodPageLocationSection";
import { PodPageStickyNav } from "@/components/pod/PodPageStickyNav";
import { PodPageStickyCta } from "@/components/pod/PodPageStickyCta";
import { PodPageVendorSection } from "@/components/pod/PodPageVendorSection";
import { PodAnnouncementBanner } from "@/components/pod/PodAnnouncementBanner";
import { PodQrEntryBanner } from "@/components/pod/PodQrEntryBanner";
import { ScrollPodVendorIntoView } from "@/components/pod/ScrollPodVendorIntoView";
import type { PodCustomerPageData } from "@/lib/pod-customer-page-data";

/** Legacy/classic pod page template. Destination is the current default. */
type StandardPodPageViewProps = PodCustomerPageData & {
  isQrEntry: boolean;
  highlightVendor: string | null;
};

export function StandardPodPageView({
  pod,
  activeAnnouncement,
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
  const hasVendors = vendorRows.length > 0;

  const announcementBlock =
    activeAnnouncement != null ? (
      <PodAnnouncementBanner text={activeAnnouncement} compact={isQrEntry} />
    ) : null;

  return (
    <div className="w-full min-h-0 pb-20 lg:pb-0">
      <RecentPodViewTracker podId={pod.id} podSlug={pod.slug} podName={pod.name} />

      <PodPageHero
        podId={podId}
        name={pod.name}
        tagline={pod.tagline}
        description={pod.description}
        address={pod.address}
        imageUrl={pod.imageUrl}
        accentColor={pod.accentColor}
        orderingStatus={orderingStatus}
        hasVendors={hasVendors}
        isQrEntry={isQrEntry}
      />

      {isQrEntry ? <PodQrEntryBanner podName={pod.name} /> : null}

      <PodPageStickyNav items={navItems} podId={pod.id} podName={pod.name} />

      <ScrollPodVendorIntoView vendorId={highlightVendor} />

      {!isQrEntry ? announcementBlock : null}

      <PodPageVendorSection
        podSlug={pod.slug}
        podName={pod.name}
        rows={vendorRows}
        highlightVendorId={highlightVendor}
        orderingStatus={orderingStatus}
        showContactLink={hasLocationSection || hasContactSection}
        contactAnchorId={
          hasLocationSection ? "pod-location" : hasContactSection ? "pod-contact" : null
        }
        groupOrderHref={hasVendors ? groupOrderHref : null}
        pickupAddress={pod.address}
      />

      {isQrEntry ? announcementBlock : null}

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
        showVendorsCta={hasVendors}
        showGroupOrderCta={hasVendors}
        groupOrderHref={groupOrderHref}
      />
    </div>
  );
}

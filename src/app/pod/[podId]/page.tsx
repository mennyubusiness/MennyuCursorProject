import { notFound } from "next/navigation";
import { auth } from "@/auth";
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
import { PodPageGroupOrderSection } from "@/components/pod/PodPageGroupOrderSection";
import { POD_QR_ENTRY_VALUE } from "@/lib/pod-ordering-url";
import { buildLoginHrefWithReturn } from "@/lib/auth/login-return-path";
import { parsePodAmenities } from "@/lib/pod-amenities";
import { buildPodPageNavItems } from "@/lib/pod-page-nav";
import { getPodOrderingStatus } from "@/lib/pod-page-status";
import type { PodVendorGridRow } from "@/components/pod/PodVendorGrid";
import { prisma } from "@/lib/db";
import { getVendorAvailabilityStatus } from "@/lib/vendor-availability";

function availabilityForVendor(v: {
  isActive: boolean;
  mennyuOrdersPaused: boolean;
}): PodVendorGridRow["availability"] {
  const status = getVendorAvailabilityStatus(v);
  const unavailable = status !== "open";
  const isPosClosed = status === "closed";
  const isMennyuNotAccepting = status === "mennyu_paused";
  const isInactive = status === "inactive";
  const statusLabel = isPosClosed
    ? "Closed"
    : isMennyuNotAccepting
      ? "Not accepting orders"
      : isInactive
        ? "Unavailable"
        : "Open for orders";

  return {
    unavailable,
    statusLabel,
    showBrowseHint: isMennyuNotAccepting || isPosClosed,
  };
}

function toGridRow(
  pv: {
    isFeatured: boolean;
    vendor: {
      id: string;
      name: string;
      description: string | null;
      imageUrl: string | null;
      cuisineCategory: string | null;
      isActive: boolean;
      mennyuOrdersPaused: boolean;
    };
  }
): PodVendorGridRow {
  return {
    vendor: {
      id: pv.vendor.id,
      name: pv.vendor.name,
      description: pv.vendor.description,
      imageUrl: pv.vendor.imageUrl,
      cuisineCategory: pv.vendor.cuisineCategory,
    },
    isFeatured: pv.isFeatured,
    availability: availabilityForVendor(pv.vendor),
  };
}

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

  const [pod, session] = await Promise.all([
    prisma.pod.findUnique({
      where: { id: podId },
      include: {
        vendors: {
          where: { isActive: true },
          include: {
            vendor: {
              select: {
                id: true,
                name: true,
                description: true,
                isActive: true,
                mennyuOrdersPaused: true,
                imageUrl: true,
                cuisineCategory: true,
              },
            },
          },
          orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { vendorId: "asc" }],
        },
      },
    }),
    auth(),
  ]);

  if (!pod || !pod.isActive) notFound();

  const vendorRows = pod.vendors.map(toGridRow);
  const amenities = parsePodAmenities(pod.amenities);
  const orderingStatus = getPodOrderingStatus(vendorRows.map((r) => r.availability));

  const hasLocationSection = Boolean(pod.address?.trim());
  const hasContactSection = Boolean(
    pod.contactEmail?.trim() ||
      pod.ownerContactPhone?.trim() ||
      pod.websiteUrl?.trim() ||
      pod.instagramUrl?.trim()
  );
  const hasAboutSection = Boolean(
    pod.description?.trim() || pod.tagline?.trim() || amenities.length > 0
  );
  const showGroupOrderSection = vendorRows.length > 0;

  const contactDetails = {
    contactEmail: pod.contactEmail,
    contactPhone: pod.ownerContactPhone,
    websiteUrl: pod.websiteUrl,
    instagramUrl: pod.instagramUrl,
  };

  const groupOrderCartUrl = `/cart?startGroupOrder=1&podId=${encodeURIComponent(podId)}`;
  const groupOrderHref = session?.user
    ? groupOrderCartUrl
    : buildLoginHrefWithReturn(groupOrderCartUrl);

  const navItems = buildPodPageNavItems({
    hasAboutSection,
    hasLocationSection,
    hasContactSection,
    showGroupOrderNav: showGroupOrderSection,
  });

  return (
    <div className="w-full min-h-0 pb-20 lg:pb-0">
      <RecentPodViewTracker podId={pod.id} podName={pod.name} />

      <PodPageHero
        name={pod.name}
        tagline={pod.tagline}
        description={pod.description}
        address={pod.address}
        imageUrl={pod.imageUrl}
        accentColor={pod.accentColor}
        orderingStatus={orderingStatus}
        hasVendors={vendorRows.length > 0}
        groupOrderHref={groupOrderHref}
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

      {showGroupOrderSection && <PodPageGroupOrderSection podId={pod.id} />}

      {hasAboutSection && (
        <PodPageIdentitySection
          podName={pod.name}
          tagline={pod.tagline}
          description={pod.description}
          amenities={amenities}
        />
      )}

      {hasLocationSection && (
        <PodPageLocationSection
          podName={pod.name}
          address={pod.address!}
          pickupInstructions={pod.pickupInstructions}
        />
      )}

      {hasContactSection && <PodPageContactSection contact={contactDetails} />}

      <PodPageStickyCta
        podName={pod.name}
        showVendorsCta={vendorRows.length > 0}
        showGroupOrderCta={showGroupOrderSection}
        groupOrderHref={groupOrderHref}
      />
    </div>
  );
}

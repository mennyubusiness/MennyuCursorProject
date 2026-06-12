import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { RecentPodViewTracker } from "@/components/retention/RecentViewTracker";
import { PodPageHero } from "@/components/pod/PodPageHero";
import { PodPageIdentitySection } from "@/components/pod/PodPageIdentitySection";
import { PodPageContactSection } from "@/components/pod/PodPageContactSection";
import { PodPageStickyNav, type PodPageNavItem } from "@/components/pod/PodPageStickyNav";
import { PodPageStickyCta } from "@/components/pod/PodPageStickyCta";
import { PodVendorGrid, type PodVendorGridRow } from "@/components/pod/PodVendorGrid";
import { ScrollPodVendorIntoView } from "@/components/pod/ScrollPodVendorIntoView";
import { PageSection, PageShell } from "@/components/layout/page-shell";
import { ButtonLink } from "@/components/ui/button";
import { PodPageGroupOrderSection } from "@/components/pod/PodPageGroupOrderSection";
import { POD_QR_ENTRY_VALUE } from "@/lib/pod-ordering-url";
import { buildLoginHrefWithReturn } from "@/lib/auth/login-return-path";
import { parsePodAmenities } from "@/lib/pod-amenities";
import { getPodOrderingStatus } from "@/lib/pod-page-status";
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
  const featuredRows = vendorRows.filter((r) => r.isFeatured);
  const hasFeaturedSection =
    featuredRows.length > 0 && featuredRows.length < vendorRows.length;
  const mainVendorRows = hasFeaturedSection
    ? vendorRows.filter((r) => !r.isFeatured)
    : vendorRows;

  const amenities = parsePodAmenities(pod.amenities);
  const orderingStatus = getPodOrderingStatus(vendorRows.map((r) => r.availability));

  const contact = {
    address: pod.address,
    contactEmail: pod.contactEmail,
    contactPhone: pod.ownerContactPhone,
    websiteUrl: pod.websiteUrl,
    instagramUrl: pod.instagramUrl,
    pickupInstructions: pod.pickupInstructions,
  };

  const hasAboutSection = Boolean(pod.description?.trim() || amenities.length > 0);
  const hasContactSection = Boolean(
    contact.address?.trim() ||
      contact.contactEmail?.trim() ||
      contact.contactPhone?.trim() ||
      contact.websiteUrl?.trim() ||
      contact.instagramUrl?.trim() ||
      contact.pickupInstructions?.trim()
  );

  const groupOrderCartUrl = `/cart?startGroupOrder=1&podId=${encodeURIComponent(podId)}`;
  const groupOrderHref = session?.user
    ? groupOrderCartUrl
    : buildLoginHrefWithReturn(groupOrderCartUrl);

  const navItems: PodPageNavItem[] = [];
  if (hasAboutSection) {
    navItems.push({ id: "pod-about", label: "About" });
  }
  if (vendorRows.length > 0) {
    navItems.push({
      id: hasFeaturedSection ? "pod-featured" : "pod-vendors",
      label: hasFeaturedSection ? "Featured" : "Vendors",
    });
    if (hasFeaturedSection && mainVendorRows.length > 0) {
      navItems.push({ id: "pod-vendors", label: "All vendors" });
    }
    navItems.push({ id: "pod-group-order", label: "Group order" });
  }
  if (hasContactSection) {
    navItems.push({ id: "pod-contact", label: "Contact" });
  }

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

      {hasAboutSection && (
        <PodPageIdentitySection
          description={pod.description}
          amenities={amenities}
          address={pod.address}
        />
      )}

      {vendorRows.length > 0 && <PodPageGroupOrderSection podId={pod.id} />}

      <PageSection className="!py-8 sm:!py-10">
        <PageShell className="space-y-10 sm:space-y-12">
          {vendorRows.length === 0 ? (
            <section id="pod-vendors" className="scroll-mt-36">
              <div className="rounded-xl border border-oo-light-stone bg-oo-warm-white px-6 py-10 text-center shadow-sm">
                <p className="text-lg font-bold text-oo-charcoal">No vendors accepting orders yet</p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-oo-stone-gray">
                  {pod.name} is set up on Open Order, but no kitchens are listed right now. Check
                  back soon or explore other pods nearby.
                </p>
                {orderingStatus.tone === "closed" && (
                  <p className="mx-auto mt-3 max-w-md text-sm text-oo-stone-gray">
                    When vendors return, you&apos;ll order from one shared cart and pick up in one
                    trip.
                  </p>
                )}
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <ButtonLink href="/explore" variant="primary" size="sm">
                    Explore pods
                  </ButtonLink>
                  {hasContactSection && (
                    <a
                      href="#pod-contact"
                      className="inline-flex min-h-9 items-center rounded-lg border border-oo-light-stone bg-oo-cream px-3.5 py-2 text-sm font-semibold text-oo-charcoal hover:bg-oo-warm-white"
                    >
                      Contact &amp; location
                    </a>
                  )}
                </div>
              </div>
            </section>
          ) : (
            <>
              {hasFeaturedSection && (
                <section
                  id="pod-featured"
                  aria-labelledby="pod-featured-heading"
                  className="scroll-mt-36"
                >
                  <header className="mb-4">
                    <h2
                      id="pod-featured-heading"
                      className="text-lg font-bold tracking-tight text-oo-charcoal sm:text-xl"
                    >
                      Featured vendors
                    </h2>
                    <p className="mt-1 text-sm text-oo-stone-gray">
                      Popular picks at {pod.name} — same shared cart for every kitchen.
                    </p>
                  </header>
                  <PodVendorGrid
                    podId={podId}
                    rows={featuredRows}
                    highlightVendorId={highlightVendor}
                  />
                </section>
              )}

              <section
                id="pod-vendors"
                aria-labelledby="pod-vendors-heading"
                className="scroll-mt-36"
              >
                <header className="mb-4">
                  <h2
                    id="pod-vendors-heading"
                    className="text-lg font-bold tracking-tight text-oo-charcoal sm:text-xl"
                  >
                    {hasFeaturedSection ? "All vendors" : "Vendors"}
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm text-oo-stone-gray">
                    {orderingStatus.tone === "closed"
                      ? "Kitchens may be closed — menus are still browsable when available."
                      : "Open any kitchen for its menu. Pickup timing may vary across vendors."}
                  </p>
                </header>
                <PodVendorGrid
                  podId={podId}
                  rows={mainVendorRows}
                  highlightVendorId={highlightVendor}
                />
              </section>
            </>
          )}

          {hasContactSection && <PodPageContactSection contact={contact} />}
        </PageShell>
      </PageSection>

      <PodPageStickyCta
        podName={pod.name}
        showVendorsCta={vendorRows.length > 0}
        showGroupOrderCta={vendorRows.length > 0}
        groupOrderHref={groupOrderHref}
      />
    </div>
  );
}

import { notFound } from "next/navigation";
import { RecentPodViewTracker } from "@/components/retention/RecentViewTracker";
import { PodPageHero } from "@/components/pod/PodPageHero";
import { PodPageStickyNav, type PodPageNavItem } from "@/components/pod/PodPageStickyNav";
import { PodVendorGrid, type PodVendorGridRow } from "@/components/pod/PodVendorGrid";
import { ScrollPodVendorIntoView } from "@/components/pod/ScrollPodVendorIntoView";
import { PageSection, PageShell } from "@/components/layout/page-shell";
import { ButtonLink } from "@/components/ui/button";
import { PodPageGroupOrderSection } from "@/components/pod/PodPageGroupOrderSection";
import { POD_QR_ENTRY_VALUE } from "@/lib/pod-ordering-url";
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

  const pod = await prisma.pod.findUnique({
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
            },
          },
        },
        orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { vendorId: "asc" }],
      },
    },
  });
  if (!pod || !pod.isActive) notFound();

  const vendorRows = pod.vendors.map(toGridRow);
  const featuredRows = vendorRows.filter((r) => r.isFeatured);
  const hasFeaturedSection =
    featuredRows.length > 0 && featuredRows.length < vendorRows.length;
  const mainVendorRows = hasFeaturedSection
    ? vendorRows.filter((r) => !r.isFeatured)
    : vendorRows;

  const hasInfoSection = Boolean(pod.description?.trim() || pod.address?.trim());
  const navItems: PodPageNavItem[] = [];
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
  if (hasInfoSection) {
    navItems.push({ id: "pod-info", label: "Info" });
  }

  return (
    <div className="w-full min-h-0">
      <RecentPodViewTracker podId={pod.id} podName={pod.name} />

      <PodPageHero
        podId={pod.id}
        name={pod.name}
        description={pod.description}
        address={pod.address}
        imageUrl={pod.imageUrl}
        accentColor={pod.accentColor}
        vendorCount={pod.vendors.length}
      />

      {navItems.length > 0 && <PodPageStickyNav items={navItems} />}

      {isQrEntry && (
        <PageShell className="py-4">
          <div
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
            role="status"
          >
            <p className="font-semibold">You&apos;re ordering from {pod.name}</p>
            <p className="mt-0.5 text-emerald-900/90">Scan, order, and pick up in one trip.</p>
          </div>
        </PageShell>
      )}

      <ScrollPodVendorIntoView vendorId={highlightVendor} />

      {pod.vendors.length > 0 && <PodPageGroupOrderSection podId={pod.id} />}

      <PageSection className="!py-8 sm:!py-10">
        <PageShell className="space-y-10 sm:space-y-12">
          {pod.vendors.length === 0 ? (
            <section id="pod-vendors" className="scroll-mt-36">
              <div className="oo-empty-state">
                <p className="font-medium text-oo-charcoal">No vendors in this pod right now</p>
                <p className="mt-2 text-sm text-oo-stone-gray">Check back later or explore other pods.</p>
                <ButtonLink href="/explore" variant="secondary" size="sm" className="mt-6">
                  Explore pods
                </ButtonLink>
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
                      Popular picks at this pod — same shared cart for every kitchen.
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
                    className="text-lg font-bold tracking-tight text-black sm:text-xl"
                  >
                    {hasFeaturedSection ? "All vendors" : "Vendors"}
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm text-oo-stone-gray">
                    Open any kitchen for its menu — pickup timing may vary across vendors.
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

          {hasInfoSection && (
            <section
              id="pod-info"
              aria-labelledby="pod-info-heading"
              className="scroll-mt-36 border-t border-oo-light-stone pt-8 sm:pt-10"
            >
              <h2 id="pod-info-heading" className="text-lg font-bold tracking-tight text-oo-charcoal">
                About this pod
              </h2>
              <dl className="mt-4 space-y-3 text-sm">
                {pod.address?.trim() && (
                  <div>
                    <dt className="font-semibold text-oo-charcoal">Location</dt>
                    <dd className="mt-0.5 text-oo-stone-gray">{pod.address}</dd>
                  </div>
                )}
                <div>
                  <dt className="font-semibold text-oo-charcoal">Pickup</dt>
                  <dd className="mt-0.5 text-oo-stone-gray">
                    Order from multiple vendors in one cart — pay once, pick up at this pod.
                  </dd>
                </div>
                {pod.description?.trim() && (
                  <div>
                    <dt className="font-semibold text-zinc-900">Details</dt>
                    <dd className="mt-0.5 leading-relaxed text-zinc-600">{pod.description}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}
        </PageShell>
      </PageSection>
    </div>
  );
}

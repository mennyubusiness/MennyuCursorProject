import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { RecentPodViewTracker } from "@/components/retention/RecentViewTracker";
import { PodPageHero } from "@/components/pod/PodPageHero";
import { PodVendorCard } from "@/components/pod/PodVendorCard";
import { POD_QR_ENTRY_VALUE } from "@/lib/pod-ordering-url";
import { prisma } from "@/lib/db";
import { getVendorAvailabilityStatus } from "@/lib/vendor-availability";

function availabilityForVendor(v: {
  isActive: boolean;
  mennyuOrdersPaused: boolean;
}): {
  unavailable: boolean;
  statusLabel: string;
  showBrowseHint: boolean;
} {
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
        orderBy: [{ sortOrder: "asc" }, { vendorId: "asc" }],
      },
    },
  });
  if (!pod || !pod.isActive) notFound();

  const vendorRows = pod.vendors.map((pv) => ({
    pv,
    availability: availabilityForVendor(pv.vendor),
  }));

  const session = await auth();
  const groupOrderCartUrl = `/cart?startGroupOrder=1&podId=${encodeURIComponent(pod.id)}`;
  const groupOrderHref = session?.user
    ? groupOrderCartUrl
    : `/login?callbackUrl=${encodeURIComponent(groupOrderCartUrl)}`;

  return (
    <div className="space-y-10 rounded-2xl border border-stone-200/60 bg-gradient-to-b from-stone-200/40 to-stone-50/90 px-4 py-8 sm:px-6 sm:py-10">
      <RecentPodViewTracker podId={pod.id} podName={pod.name} />
      {isQrEntry && (
        <div
          className="rounded-xl border border-emerald-200/90 bg-emerald-50/95 px-4 py-3 text-sm text-emerald-950 shadow-sm"
          role="status"
        >
          <p className="font-medium">You&apos;re ordering from {pod.name}</p>
          <p className="mt-1 text-emerald-900/90">Scan, order, and pick up in one trip.</p>
        </div>
      )}

      <PodPageHero
        podId={pod.id}
        name={pod.name}
        description={pod.description}
        address={pod.address}
        imageUrl={pod.imageUrl}
        accentColor={pod.accentColor}
        vendorCount={pod.vendors.length}
      />

      {pod.vendors.length > 0 && (
        <div className="rounded-2xl border border-stone-200/80 bg-white/80 px-4 py-4 shadow-sm sm:px-5">
          <p className="text-center text-sm text-stone-700 sm:text-left">
            <Link
              href={groupOrderHref}
              className="font-semibold text-stone-900 underline decoration-stone-300 underline-offset-4 transition hover:bg-mennyu-primary hover:text-black hover:no-underline focus-visible:rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mennyu-primary"
            >
              Ordering with friends? Start a group order →
            </Link>
          </p>
        </div>
      )}

      <section aria-labelledby="pod-vendors-heading">
        <div className="mb-6">
          <h2 id="pod-vendors-heading" className="text-xl font-semibold text-stone-900 sm:text-2xl">
            Vendors
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600">
            Open any kitchen for its full menu — your cart is shared across vendors. Pickup timing can vary.
          </p>
        </div>

        {pod.vendors.length === 0 ? (
          <div className="rounded-2xl border border-stone-200/80 bg-white/90 p-10 text-center shadow-sm">
            <p className="text-stone-700">No vendors in this pod right now.</p>
            <p className="mt-2 text-sm text-stone-500">Check back later or explore other pods.</p>
            <Link
              href="/explore"
              className="mt-6 inline-flex rounded-xl bg-mennyu-primary px-5 py-2.5 text-sm font-semibold text-black shadow-sm transition hover:bg-mennyu-secondary"
            >
              Explore pods
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {vendorRows.map(({ pv, availability }) => (
              <li key={pv.vendor.id} className="flex min-h-0">
                <PodVendorCard
                  podId={podId}
                  variant="grid"
                  vendor={{
                    id: pv.vendor.id,
                    name: pv.vendor.name,
                    description: pv.vendor.description,
                    imageUrl: pv.vendor.imageUrl,
                  }}
                  isFeatured={pv.isFeatured}
                  availability={availability}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

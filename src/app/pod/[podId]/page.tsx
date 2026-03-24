import Link from "next/link";
import { notFound } from "next/navigation";
import { PodLogo } from "@/components/images/PodLogo";
import { VendorLogo } from "@/components/images/VendorLogo";
import { prisma } from "@/lib/db";
import { getVendorAvailabilityStatus } from "@/lib/vendor-availability";

export default async function PodPage({ params }: { params: Promise<{ podId: string }> }) {
  const { podId } = await params;
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
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!pod || !pod.isActive) notFound();

  const vendorCount = pod.vendors.length;

  return (
    <div className="space-y-10">
      <header className="border-b border-stone-200 pb-8">
        <PodLogo imageUrl={pod.imageUrl} podName={pod.name} />
        <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-stone-500">
          Food pod
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
          {pod.name}
        </h1>
        {pod.address && (
          <p className="mt-3 max-w-2xl text-base text-stone-600">{pod.address}</p>
        )}
        {pod.description && (
          <p className="mt-3 max-w-2xl text-stone-600">{pod.description}</p>
        )}
        <p className="mt-4 text-sm text-stone-500">
          {vendorCount === 0
            ? "No vendors listed yet."
            : `${vendorCount} vendor${vendorCount === 1 ? "" : "s"} at this location`}
        </p>
      </header>

      <section aria-labelledby="pod-vendors-heading">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="pod-vendors-heading" className="text-xl font-semibold text-stone-900">
              Vendors
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Browse menus and build one cart for checkout. Availability updates here before you
              order.
            </p>
          </div>
        </div>

        {pod.vendors.length === 0 ? (
          <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-10 text-center">
            <p className="text-stone-700">No vendors in this pod right now.</p>
            <p className="mt-2 text-sm text-stone-500">Check back later or explore other pods.</p>
            <Link
              href="/explore"
              className="mt-6 inline-flex rounded-xl bg-mennyu-primary px-5 py-2.5 text-sm font-semibold text-black hover:bg-mennyu-secondary"
            >
              Explore pods
            </Link>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {pod.vendors.map((pv) => {
              const status = getVendorAvailabilityStatus(pv.vendor);
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

              return (
                <li key={pv.vendor.id}>
                  <Link
                    href={`/pod/${podId}/vendor/${pv.vendor.id}`}
                    className={`flex h-full gap-4 rounded-2xl border p-4 shadow-sm transition hover:border-mennyu-primary/40 hover:shadow-md sm:p-5 ${
                      unavailable
                        ? "border-stone-200 bg-stone-50/90"
                        : "border-stone-200 bg-white"
                    }`}
                    aria-label={`${pv.vendor.name} — ${statusLabel}. View menu.`}
                  >
                    <VendorLogo imageUrl={pv.vendor.imageUrl} vendorName={pv.vendor.name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-stone-900">{pv.vendor.name}</h3>
                        {!unavailable ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">
                            Open
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                            {statusLabel}
                          </span>
                        )}
                      </div>
                      {pv.vendor.description && (
                        <p className="mt-2 line-clamp-2 text-sm text-stone-600">
                          {pv.vendor.description}
                        </p>
                      )}
                      {(isMennyuNotAccepting || isPosClosed) && (
                        <p className="mt-2 text-xs text-stone-500">You can still browse the menu.</p>
                      )}
                      <span className="mt-3 inline-flex items-center text-sm font-medium text-mennyu-primary">
                        View menu
                        <span aria-hidden className="ml-1">
                          →
                        </span>
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

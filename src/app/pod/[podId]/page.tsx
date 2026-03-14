import Link from "next/link";
import { notFound } from "next/navigation";
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
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!pod || !pod.isActive) notFound();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-stone-900">{pod.name}</h1>
        {pod.description && (
          <p className="mt-2 text-stone-600">{pod.description}</p>
        )}
        {pod.address && (
          <p className="mt-1 text-sm text-stone-500">{pod.address}</p>
        )}
      </div>
      <h2 className="mb-4 text-lg font-medium">Vendors</h2>
      {pod.vendors.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-8 text-center">
          <p className="text-stone-600">No vendors in this pod right now.</p>
          <p className="mt-1 text-sm text-stone-500">Check back later or explore other pods.</p>
          <Link href="/explore" className="mt-4 inline-block text-mennyu-primary hover:underline">
            Explore pods →
          </Link>
        </div>
      ) : (
      <div className="grid gap-4 sm:grid-cols-2">
        {pod.vendors.map((pv) => {
          const status = getVendorAvailabilityStatus(pv.vendor);
          const unavailable = status !== "open";
          const isPosClosed = status === "closed";
          const isMennyuNotAccepting = status === "mennyu_paused";
          const isInactive = status === "inactive";
          return (
            <Link
              key={pv.vendor.id}
              href={`/pod/${podId}/vendor/${pv.vendor.id}`}
              className={`block rounded-xl border p-5 shadow-sm transition hover:border-mennyu-primary/30 hover:shadow-md ${
                unavailable
                  ? "border-stone-200 bg-stone-50/80 opacity-90"
                  : "border-stone-200 bg-white"
              }`}
              aria-label={unavailable ? `${pv.vendor.name} — ${isPosClosed ? "closed" : isInactive ? "not available" : "not accepting orders"}, view menu` : undefined}
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-stone-900">{pv.vendor.name}</h3>
                  {isPosClosed && (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      Closed
                    </span>
                  )}
                  {isMennyuNotAccepting && (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      Not accepting orders right now
                    </span>
                  )}
                  {isInactive && (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      Not available
                    </span>
                  )}
                </div>
                {pv.vendor.description && (
                  <p className="mt-1 text-sm text-stone-600">{pv.vendor.description}</p>
                )}
                {(isMennyuNotAccepting || isPosClosed) && (
                  <p className="mt-1 text-xs text-stone-500">You can still browse the menu.</p>
                )}
              </div>
              <span className="mt-2 inline-block text-sm text-mennyu-primary">View menu →</span>
            </Link>
          );
        })}
      </div>
      )}
    </div>
  );
}

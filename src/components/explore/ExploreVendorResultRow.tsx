import Link from "next/link";

export type ExploreVendorSearchHit = {
  vendorId: string;
  vendorName: string;
  description: string | null;
  podId: string;
  podName: string;
};

/** Lightweight secondary row for explore search — not the full pod-page vendor card. */
export function ExploreVendorResultRow({ hit }: { hit: ExploreVendorSearchHit }) {
  const menuHref = `/pod/${hit.podId}/vendor/${hit.vendorId}`;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-stone-200/90 bg-white/90 px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-stone-900">{hit.vendorName}</p>
        {hit.description?.trim() ? (
          <p className="mt-1 line-clamp-2 text-sm text-stone-600">{hit.description.trim()}</p>
        ) : null}
        <p className="mt-2 text-xs text-stone-500">
          Located in <span className="font-medium text-stone-700">{hit.podName}</span>
        </p>
      </div>
      <Link
        href={menuHref}
        className="inline-flex shrink-0 items-center justify-center rounded-lg bg-stone-100 px-4 py-2 text-sm font-semibold text-stone-900 ring-1 ring-stone-200/80 transition hover:bg-mennyu-primary hover:text-black hover:ring-mennyu-primary"
      >
        Start order →
      </Link>
    </div>
  );
}

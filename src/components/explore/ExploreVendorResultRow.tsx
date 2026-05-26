import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";

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
    <div className="oo-card-hover flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-lg font-bold text-black">{hit.vendorName}</p>
        {hit.description?.trim() ? (
          <p className="mt-1 line-clamp-2 text-sm text-zinc-600">{hit.description.trim()}</p>
        ) : null}
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          At <span className="text-zinc-800">{hit.podName}</span>
        </p>
      </div>
      <Link href={menuHref} className={buttonClassName({ size: "md", className: "w-full sm:w-auto" })}>
        Start order →
      </Link>
    </div>
  );
}

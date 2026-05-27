"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

import type { ExploreVendorHit } from "@/lib/explore-discovery";
import type { VendorAvailabilityStatus } from "@/lib/vendor-availability";
import { isHttpsImageUrl } from "@/lib/remote-image-url";
import { vendorInitials } from "@/lib/vendor-initials";
import { cn } from "@/lib/cn";

function ExploreVendorStatusBadge({ status }: { status: VendorAvailabilityStatus }) {
  if (status === "open") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/45 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" aria-hidden />
        Open
      </span>
    );
  }

  const label =
    status === "closed"
      ? "Closed"
      : status === "mennyu_paused"
        ? "Paused"
        : "Unavailable";

  return (
    <span className="inline-flex items-center rounded-full border border-white/20 bg-black/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white/90 backdrop-blur-sm">
      {label}
    </span>
  );
}

function ExploreVendorCardMedia({
  imageUrl,
  vendorName,
}: {
  imageUrl: string | null;
  vendorName: string;
}) {
  const [loadFailed, setLoadFailed] = useState(false);
  const canTry = isHttpsImageUrl(imageUrl) && !loadFailed;

  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden bg-oo-cream sm:aspect-[5/3]">
      {canTry ? (
        <Image
          src={imageUrl!}
          alt={vendorName}
          fill
          className="object-cover transition duration-300 ease-out group-hover:scale-[1.02]"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          onError={() => setLoadFailed(true)}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center bg-gradient-to-br from-oo-charcoal to-oo-stone-gray text-3xl font-black text-oo-cream/90"
          aria-hidden
        >
          {vendorInitials(vendorName)}
        </div>
      )}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-black/5"
        aria-hidden
      />
    </div>
  );
}

/** Image-forward vendor card for Explore discovery. */
export function ExploreVendorResultRow({ hit }: { hit: ExploreVendorHit }) {
  const menuHref = `/pod/${hit.podId}/vendor/${hit.vendorId}`;
  const cuisine = hit.cuisineCategory?.trim();
  const matchedMenuCategory = hit.matchedMenuCategory?.trim();

  return (
    <article
      className={cn(
        "group overflow-hidden rounded-xl border border-oo-light-stone bg-oo-warm-white shadow-sm transition duration-300",
        "hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0",
        hit.availabilityStatus !== "open" && "opacity-95"
      )}
    >
      <div className="relative">
        <ExploreVendorCardMedia imageUrl={hit.imageUrl} vendorName={hit.vendorName} />
        <div className="pointer-events-none absolute left-3 top-3 z-10">
          <ExploreVendorStatusBadge status={hit.availabilityStatus} />
        </div>
        <Link
          href={menuHref}
          className={cn(
            "absolute bottom-3 right-3 z-10 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-lg",
            "bg-[#F97316] transition hover:bg-[#EA580C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          )}
        >
          Start order →
        </Link>
      </div>

      <div className="space-y-2 p-4">
        <h3 className="line-clamp-2 text-base font-bold leading-snug text-oo-charcoal sm:text-lg">
          {hit.vendorName}
        </h3>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-oo-stone-gray">
          <span>
            At <span className="text-oo-charcoal">{hit.podName}</span>
          </span>
          {cuisine && (
            <>
              <span aria-hidden className="text-oo-light-stone">
                ·
              </span>
              <span>{cuisine}</span>
            </>
          )}
        </div>
        {matchedMenuCategory ? (
          <span className="inline-flex max-w-full truncate rounded-full border border-oo-light-stone bg-oo-cream px-2.5 py-0.5 text-[11px] font-semibold text-oo-charcoal">
            Menu: {matchedMenuCategory}
          </span>
        ) : null}
      </div>
    </article>
  );
}

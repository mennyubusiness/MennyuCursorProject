"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { isHttpsImageUrl } from "@/lib/remote-image-url";
import { vendorInitials } from "@/lib/vendor-initials";
import { cn } from "@/lib/cn";

export type PodVendorCardVendor = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  cuisineCategory: string | null;
};

type AvailabilityLabel = {
  unavailable: boolean;
  statusLabel: string;
  showBrowseHint: boolean;
};

type PodVendorCardProps = {
  podId: string;
  variant: "grid" | "strip";
  vendor: PodVendorCardVendor;
  isFeatured: boolean;
  availability: AvailabilityLabel;
};

function VendorCardMedia({
  imageUrl,
  vendorName,
  sizes,
  compact,
}: {
  imageUrl: string | null;
  vendorName: string;
  sizes: string;
  compact?: boolean;
}) {
  const [loadFailed, setLoadFailed] = useState(false);
  const canTry = isHttpsImageUrl(imageUrl) && !loadFailed;

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden bg-gradient-to-br from-oo-cream to-oo-light-stone/80",
        compact ? "aspect-[16/9]" : "aspect-[16/9] sm:aspect-[5/3]"
      )}
    >
      {canTry ? (
        <Image
          src={imageUrl!}
          alt={vendorName}
          fill
          className="object-cover transition duration-300 ease-out group-hover:scale-[1.03]"
          sizes={sizes}
          onError={() => setLoadFailed(true)}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center bg-gradient-to-br from-oo-cream via-oo-warm-white to-oo-light-stone/60 text-2xl font-bold text-oo-stone-gray"
          aria-hidden
        >
          {vendorInitials(vendorName)}
        </div>
      )}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-oo-charcoal/35 via-transparent to-transparent"
        aria-hidden
      />
    </div>
  );
}

/** Vendor cards for pod marketplace grids and horizontal strips. */
export function PodVendorCard({ podId, variant, vendor, isFeatured, availability }: PodVendorCardProps) {
  const href = `/pod/${podId}/vendor/${vendor.id}`;
  const grid = variant === "grid";
  const cuisine = vendor.cuisineCategory?.trim();
  const ctaLabel = availability.unavailable ? "View menu" : "Order now";

  return (
    <Link
      href={href}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-xl border border-oo-light-stone bg-oo-warm-white shadow-sm transition duration-200",
        "hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md motion-reduce:hover:translate-y-0",
        grid ? "w-full" : "w-[min(10.5rem,40vw)] shrink-0",
        availability.unavailable && "opacity-95"
      )}
      aria-label={`${vendor.name}${cuisine ? `, ${cuisine}` : ""} — ${availability.statusLabel}. ${ctaLabel}.`}
    >
      <VendorCardMedia
        imageUrl={vendor.imageUrl}
        vendorName={vendor.name}
        sizes={
          grid
            ? "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 280px"
            : "168px"
        }
        compact={grid}
      />
      <div className={cn("flex flex-1 flex-col", grid ? "p-3.5 sm:p-4" : "p-2.5")}>
        <div className="flex flex-wrap items-center gap-1.5 gap-y-1">
          <h3
            className={cn(
              "font-semibold text-oo-charcoal",
              grid ? "line-clamp-1 text-base leading-snug" : "line-clamp-2 text-xs leading-snug"
            )}
          >
            {vendor.name}
          </h3>
          {isFeatured && (
            <span className="rounded-full border border-brand/25 bg-brand/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand">
              Featured
            </span>
          )}
        </div>

        {cuisine && grid && (
          <p className="mt-1 text-xs font-medium text-oo-stone-gray">{cuisine}</p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {!availability.unavailable ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-emerald-900 ring-1 ring-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
              Open
            </span>
          ) : (
            <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-amber-950 ring-1 ring-amber-200">
              {availability.statusLabel}
            </span>
          )}
        </div>

        {grid && vendor.description && (
          <p className="mt-2 line-clamp-2 flex-1 text-sm leading-snug text-oo-stone-gray">
            {vendor.description}
          </p>
        )}
        {availability.showBrowseHint && grid && (
          <p className="mt-1 text-xs text-oo-stone-gray">Menu still browsable</p>
        )}
        <span
          className={cn(
            "mt-3 inline-flex w-fit min-h-11 items-center rounded-lg font-semibold transition duration-200",
            "bg-oo-charcoal px-4 py-2.5 text-sm text-oo-warm-white group-hover:bg-brand group-focus-visible:bg-brand",
            grid ? "text-base" : "px-3 py-2 text-xs"
          )}
        >
          {ctaLabel} →
        </span>
      </div>
    </Link>
  );
}

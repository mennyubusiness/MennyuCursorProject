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
        "relative w-full overflow-hidden bg-zinc-200",
        compact ? "aspect-[16/9]" : "aspect-[16/9] sm:aspect-[5/3]"
      )}
    >
      {canTry ? (
        <Image
          src={imageUrl!}
          alt={vendorName}
          fill
          className="object-cover transition duration-300 ease-out group-hover:scale-[1.02]"
          sizes={sizes}
          onError={() => setLoadFailed(true)}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-200 to-zinc-300 text-xl font-bold text-zinc-500"
          aria-hidden
        >
          {vendorInitials(vendorName)}
        </div>
      )}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 to-transparent"
        aria-hidden
      />
    </div>
  );
}

/** Vendor cards for pod marketplace grids and horizontal strips. */
export function PodVendorCard({ podId, variant, vendor, isFeatured, availability }: PodVendorCardProps) {
  const href = `/pod/${podId}/vendor/${vendor.id}`;
  const grid = variant === "grid";

  return (
    <Link
      href={href}
      className={cn(
        "group flex h-full flex-col overflow-hidden oo-card-hover motion-reduce:hover:translate-y-0",
        grid ? "w-full" : "w-[min(10.5rem,40vw)] shrink-0",
        availability.unavailable && "opacity-90"
      )}
      aria-label={`${vendor.name} — ${availability.statusLabel}. ${availability.unavailable ? "Browse menu." : "Start order."}`}
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
      <div className={cn("flex flex-1 flex-col", grid ? "p-3 sm:p-3.5" : "p-2.5")}>
        <div className="flex flex-wrap items-center gap-1 gap-y-0.5">
          <h3
            className={cn(
              "font-semibold text-oo-charcoal",
              grid ? "line-clamp-1 text-sm leading-snug" : "line-clamp-2 text-xs leading-snug"
            )}
          >
            {vendor.name}
          </h3>
          {isFeatured && (
            <span className="oo-badge border border-oo-light-stone bg-oo-warm-white px-1.5 py-0 text-[9px] text-oo-stone-gray">
              Featured
            </span>
          )}
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {!availability.unavailable ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
              Open
            </span>
          ) : (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">
              {availability.statusLabel}
            </span>
          )}
        </div>

        {grid && vendor.description && (
          <p className="mt-1.5 line-clamp-2 flex-1 text-xs leading-snug text-oo-stone-gray">
            {vendor.description}
          </p>
        )}
        {availability.showBrowseHint && grid && (
          <p className="mt-1 text-[11px] text-oo-stone-gray">Menu still browsable</p>
        )}
        <span
          className={cn(
            "mt-2.5 inline-flex w-fit items-center rounded-lg font-semibold transition duration-200",
            "bg-oo-charcoal px-2.5 py-1 text-xs text-oo-warm-white group-hover:bg-brand group-focus-visible:bg-brand",
            grid ? "" : "px-2 py-0.5 text-[11px]"
          )}
        >
          Start order →
        </span>
      </div>
    </Link>
  );
}

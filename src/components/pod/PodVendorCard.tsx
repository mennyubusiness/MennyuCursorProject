"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { isHttpsImageUrl } from "@/lib/remote-image-url";
import { vendorInitials } from "@/lib/vendor-initials";

export type PodVendorCardVendor = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
};

type AvailabilityLabel = {
  unavailable: boolean;
  statusLabel: string;
  /** Show "You can still browse" hint */
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
}: {
  imageUrl: string | null;
  vendorName: string;
  sizes: string;
}) {
  const [loadFailed, setLoadFailed] = useState(false);
  const canTry = isHttpsImageUrl(imageUrl) && !loadFailed;

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-stone-200">
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
          className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-200 to-stone-300 text-2xl font-bold text-stone-500 sm:text-3xl"
          aria-hidden
        >
          {vendorInitials(vendorName)}
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" aria-hidden />
    </div>
  );
}

/** Vendor grid / browse strip cards — equal visual weight; yellow only on CTA hover. */
export function PodVendorCard({ podId, variant, vendor, isFeatured, availability }: PodVendorCardProps) {
  const href = `/pod/${podId}/vendor/${vendor.id}`;
  const grid = variant === "grid";

  return (
    <Link
      href={href}
      className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-md ring-1 ring-black/[0.04] transition duration-300 motion-reduce:transform-none ${
        grid
          ? "w-full hover:-translate-y-0.5 hover:scale-[1.01] hover:shadow-xl"
          : "w-[min(11.5rem,42vw)] shrink-0 hover:-translate-y-0.5 hover:shadow-lg"
      } ${availability.unavailable ? "opacity-95" : ""}`}
      aria-label={`${vendor.name} — ${availability.statusLabel}. ${availability.unavailable ? "Browse menu." : "Start order."}`}
    >
      <VendorCardMedia
        imageUrl={vendor.imageUrl}
        vendorName={vendor.name}
        sizes={grid ? "(max-width: 640px) 100vw, 360px" : "180px"}
      />
      <div className={grid ? "flex flex-1 flex-col p-4 sm:p-5" : "flex flex-1 flex-col p-3"}>
        <div className="flex flex-wrap items-center gap-1.5 gap-y-1">
          <h3 className={`font-semibold text-stone-900 ${grid ? "text-lg" : "line-clamp-2 text-sm leading-snug"}`}>
            {vendor.name}
          </h3>
          {isFeatured && (
            <span className="rounded-full border border-stone-300 bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-stone-500">
              Featured
            </span>
          )}
          {!availability.unavailable ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900">
              Open
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
              {availability.statusLabel}
            </span>
          )}
        </div>
        {grid && vendor.description && (
          <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-stone-600">{vendor.description}</p>
        )}
        {availability.showBrowseHint && grid && (
          <p className="mt-2 text-xs text-stone-500">You can still browse the menu.</p>
        )}
        <span
          className={`mt-3 inline-flex w-fit items-center rounded-lg font-semibold text-mennyu-primary ring-1 ring-mennyu-primary/30 transition group-hover:bg-mennyu-primary group-hover:text-black group-hover:ring-mennyu-primary ${
            grid ? "px-3 py-1.5 text-sm" : "px-2.5 py-1 text-xs"
          }`}
        >
          Start order →
        </span>
      </div>
    </Link>
  );
}

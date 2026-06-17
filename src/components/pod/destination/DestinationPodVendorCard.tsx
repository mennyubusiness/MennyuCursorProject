"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { isHttpsImageUrl } from "@/lib/remote-image-url";
import { vendorInitials } from "@/lib/vendor-initials";
import { cn } from "@/lib/cn";
import type { PodVendorCardVendor } from "@/components/pod/PodVendorCard";

type AvailabilityLabel = {
  unavailable: boolean;
  statusLabel: string;
  showBrowseHint: boolean;
};

type DestinationPodVendorCardProps = {
  podId: string;
  vendor: PodVendorCardVendor;
  isFeatured: boolean;
  availability: AvailabilityLabel;
};

function VendorMedia({ imageUrl, vendorName }: { imageUrl: string | null; vendorName: string }) {
  const [loadFailed, setLoadFailed] = useState(false);
  const canTry = isHttpsImageUrl(imageUrl) && !loadFailed;

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-oo-cream to-oo-light-stone/80 sm:aspect-[16/10]">
      {canTry ? (
        <Image
          src={imageUrl!}
          alt={vendorName}
          fill
          className="object-cover transition duration-300 ease-out group-hover:scale-[1.03]"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 420px"
          onError={() => setLoadFailed(true)}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center bg-gradient-to-br from-oo-cream via-oo-warm-white to-brand/10 text-3xl font-bold text-oo-stone-gray"
          aria-hidden
        >
          {vendorInitials(vendorName)}
        </div>
      )}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-oo-charcoal/45 via-transparent to-transparent"
        aria-hidden
      />
    </div>
  );
}

/** Larger destination-style vendor card for pod marketplace grids. */
export function DestinationPodVendorCard({
  podId,
  vendor,
  isFeatured,
  availability,
}: DestinationPodVendorCardProps) {
  const href = `/pod/${podId}/vendor/${vendor.id}`;
  const cuisine = vendor.cuisineCategory?.trim();
  const description = vendor.description?.trim();
  const ctaLabel = availability.unavailable ? "View menu" : "Order now";

  return (
    <Link
      href={href}
      className={cn(
        "group flex h-full min-h-[44px] flex-col overflow-hidden rounded-2xl border border-oo-light-stone bg-oo-warm-white shadow-sm transition duration-200",
        "hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-md motion-reduce:hover:translate-y-0",
        availability.unavailable && "opacity-95"
      )}
      aria-label={`${vendor.name}${cuisine ? `, ${cuisine}` : ""} — ${availability.statusLabel}. ${ctaLabel}.`}
    >
      <VendorMedia imageUrl={vendor.imageUrl} vendorName={vendor.name} />
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-2">
          <h3 className="text-lg font-bold leading-snug text-oo-charcoal sm:text-xl">{vendor.name}</h3>
          {isFeatured && (
            <span className="rounded-full border border-brand/25 bg-brand/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand">
              Featured
            </span>
          )}
        </div>

        {cuisine && <p className="mt-1 text-sm font-medium text-oo-stone-gray">{cuisine}</p>}

        <div className="mt-3">
          {!availability.unavailable ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-emerald-900 ring-1 ring-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
              Open for orders
            </span>
          ) : (
            <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-amber-950 ring-1 ring-amber-200">
              {availability.statusLabel}
            </span>
          )}
        </div>

        {description && (
          <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-oo-stone-gray">
            {description}
          </p>
        )}

        {availability.showBrowseHint && (
          <p className="mt-2 text-xs text-oo-stone-gray">Menu still browsable</p>
        )}

        <span
          className={cn(
            "mt-4 inline-flex w-full min-h-11 items-center justify-center rounded-xl font-semibold transition duration-200 sm:w-fit sm:px-5",
            "bg-oo-charcoal text-oo-warm-white group-hover:bg-brand group-focus-visible:bg-brand"
          )}
        >
          {ctaLabel} →
        </span>
      </div>
    </Link>
  );
}

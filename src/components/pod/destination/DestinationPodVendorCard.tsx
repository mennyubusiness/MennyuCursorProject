"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { isHttpsImageUrl } from "@/lib/remote-image-url";
import { vendorInitials } from "@/lib/vendor-initials";
import { cn } from "@/lib/cn";
import { buildVendorMenuCustomerPath } from "@/lib/customer-public-url";
import type { PodVendorCardVendor } from "@/components/pod/PodVendorCard";

type AvailabilityLabel = {
  unavailable: boolean;
  statusLabel: string;
  showBrowseHint: boolean;
};

type DestinationPodVendorCardProps = {
  podSlug: string;
  vendor: PodVendorCardVendor;
  isFeatured: boolean;
  availability: AvailabilityLabel;
};

function VendorMedia({
  imageUrl,
  vendorName,
  muted,
}: {
  imageUrl: string | null;
  vendorName: string;
  muted?: boolean;
}) {
  const [loadFailed, setLoadFailed] = useState(false);
  const canTry = isHttpsImageUrl(imageUrl) && !loadFailed;

  return (
    <div
      className={cn(
        "relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-oo-cream to-oo-light-stone/80 sm:aspect-[16/10]",
        muted && "opacity-90"
      )}
    >
      {canTry ? (
        <Image
          src={imageUrl!}
          alt={vendorName}
          fill
          className={cn(
            "object-cover transition duration-300 ease-out group-hover:scale-[1.03]",
            muted && "grayscale-[0.35]"
          )}
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
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-oo-charcoal/40 via-transparent to-transparent"
        aria-hidden
      />
    </div>
  );
}

/** Showcase-style vendor card for the Destination pod page — visual, low-clutter, fully tappable. */
export function DestinationPodVendorCard({
  podSlug,
  vendor,
  isFeatured,
  availability,
}: DestinationPodVendorCardProps) {
  const href = buildVendorMenuCustomerPath(podSlug, vendor.slug);
  const cuisine = vendor.cuisineCategory?.trim();
  const description = vendor.description?.trim();
  const unavailable = availability.unavailable;
  const ctaLabel = unavailable ? "View menu" : "Order now";

  return (
    <Link
      href={href}
      className={cn(
        "group flex h-full min-h-[44px] flex-col overflow-hidden rounded-2xl border border-oo-light-stone bg-oo-warm-white shadow-sm transition duration-200",
        "hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-md motion-reduce:hover:translate-y-0",
        isFeatured && !unavailable && "ring-1 ring-brand/25",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-oo-cream",
        unavailable && "hover:border-oo-light-stone"
      )}
      aria-label={`${vendor.name}${cuisine ? `, ${cuisine}` : ""} — ${availability.statusLabel}. ${ctaLabel}.`}
    >
      <VendorMedia imageUrl={vendor.imageUrl} vendorName={vendor.name} muted={unavailable} />
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
          <h3 className="break-words text-lg font-bold leading-snug text-oo-charcoal sm:text-xl">
            {vendor.name}
          </h3>
          {isFeatured && (
            <span
              className={cn(
                "rounded-full border border-brand/20 bg-brand/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand",
                unavailable && "opacity-60"
              )}
            >
              Featured
            </span>
          )}
        </div>

        {cuisine && <p className="mt-1 text-sm font-medium text-oo-stone-gray">{cuisine}</p>}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {!unavailable ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-emerald-900 ring-1 ring-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
              Open
            </span>
          ) : (
            <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-amber-950 ring-1 ring-amber-200">
              {availability.statusLabel}
            </span>
          )}
        </div>

        {description && (
          <p
            className={cn(
              "line-clamp-3 flex-1 text-sm leading-relaxed text-oo-stone-gray",
              unavailable ? "mt-2" : "mt-3"
            )}
          >
            {description}
          </p>
        )}

        {availability.showBrowseHint && (
          <p className="mt-2 text-xs text-oo-stone-gray">Menu still browsable</p>
        )}

        <span
          className={cn(
            "mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg text-sm font-semibold transition duration-200",
            unavailable
              ? "border border-oo-light-stone bg-oo-cream text-oo-charcoal group-hover:bg-oo-warm-white"
              : "bg-brand text-white group-hover:bg-brand-hover"
          )}
        >
          {ctaLabel} →
        </span>
      </div>
    </Link>
  );
}

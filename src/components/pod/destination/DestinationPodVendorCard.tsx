"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { isHttpsImageUrl } from "@/lib/remote-image-url";
import { vendorInitials } from "@/lib/vendor-initials";
import { cn } from "@/lib/cn";
import { buildVendorMenuCustomerPath } from "@/lib/customer-public-url";
import type { PodVendorCardVendor } from "@/components/pod/PodVendorCard";
import { VendorHoursDisclosure } from "@/components/vendor/VendorHoursDisclosure";
import type { VendorHoursDisplayModel } from "@/lib/vendor-hours-display";
import { MENU_ONLY_BADGE } from "@/lib/vendor-ordering-mode";

type AvailabilityLabel = {
  unavailable: boolean;
  statusLabel: string;
  showBrowseHint: boolean;
  menuOnly?: boolean;
};

type DestinationPodVendorCardProps = {
  podSlug: string;
  vendor: PodVendorCardVendor;
  isFeatured: boolean;
  availability: AvailabilityLabel;
  /** Label menu-only cards on mixed pods only; a fully menu-only pod says so once, up top. */
  showMenuOnlyBadge?: boolean;
  hoursDisplay: VendorHoursDisplayModel;
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
  showMenuOnlyBadge = false,
  hoursDisplay,
}: DestinationPodVendorCardProps) {
  const href = buildVendorMenuCustomerPath(podSlug, vendor.slug);
  const cuisine = vendor.cuisineCategory?.trim();
  const description = vendor.description?.trim();
  const unavailable = availability.unavailable;
  /** Menu-only is not unavailable: the card stays full-colour and only gains a small label. */
  const statusNote = unavailable
    ? availability.statusLabel
    : availability.menuOnly && showMenuOnlyBadge
      ? MENU_ONLY_BADGE
      : null;

  return (
    <div
      className={cn(
        "group flex h-full min-h-[44px] flex-col overflow-hidden rounded-2xl border border-oo-light-stone bg-oo-warm-white shadow-sm transition duration-200",
        "hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-md motion-reduce:hover:translate-y-0",
        isFeatured && !unavailable && "ring-1 ring-brand/25",
        unavailable && "hover:border-oo-light-stone"
      )}
    >
      <Link
        href={href}
        className="flex min-h-0 flex-1 flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-oo-cream"
        aria-label={`${vendor.name}${cuisine ? `, ${cuisine}` : ""}${unavailable ? ` — ${availability.statusLabel}` : ""}. View menu.`}
      >
      <VendorMedia imageUrl={vendor.imageUrl} vendorName={vendor.name} muted={unavailable} />
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
          <h3 className="text-lg font-bold leading-snug text-oo-charcoal sm:text-xl">{vendor.name}</h3>
          {isFeatured && (
            <span className="rounded-full border border-brand/20 bg-brand/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
              Featured
            </span>
          )}
        </div>

        {cuisine && <p className="mt-1 text-sm font-medium text-oo-stone-gray">{cuisine}</p>}

        {statusNote && (
          <p className="mt-2 text-xs font-medium text-oo-stone-gray">{statusNote}</p>
        )}

        {description && (
          <p
            className={cn(
              "line-clamp-3 flex-1 text-sm leading-relaxed text-oo-stone-gray",
              statusNote ? "mt-2" : "mt-3"
            )}
          >
            {description}
          </p>
        )}
      </div>
      </Link>

      <div className="border-t border-oo-light-stone/70 px-4 pb-4 pt-2 sm:px-5 sm:pb-5">
        <VendorHoursDisclosure display={hoursDisplay} compact />
      </div>
    </div>
  );
}

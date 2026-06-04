"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { isHttpsImageUrl } from "@/lib/remote-image-url";
import { vendorInitials } from "@/lib/vendor-initials";
import {
  formatPodCuisinePreviewLine,
  formatPodVendorCountLine,
  getPodVendorCounts,
} from "@/lib/explore-discovery";
import { FavoritePodButton } from "@/components/retention/FavoritePodButton";
import { cn } from "@/lib/cn";

export type PodCardPod = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  accentColor: string | null;
  address?: string | null;
  vendors: {
    vendor: {
      id: string;
      name: string;
      description: string | null;
      cuisineCategory?: string | null;
      locationSummary?: string | null;
      imageUrl?: string | null;
      menuCategoryNames?: string[];
      isActive?: boolean;
      mennyuOrdersPaused?: boolean;
    };
  }[];
};

type PodCardProps = {
  pod: PodCardPod;
  variant?: "full" | "compact";
  /** When set, card selects pod on Explore instead of navigating away. */
  onSelectPod?: (podId: string) => void;
  isSelected?: boolean;
};

function PodCardMedia({
  imageUrl,
  podName,
  sizes,
}: {
  imageUrl: string | null;
  podName: string;
  sizes: string;
}) {
  const [loadFailed, setLoadFailed] = useState(false);
  const canTry = isHttpsImageUrl(imageUrl) && !loadFailed;

  return (
    <div className="relative h-full w-full overflow-hidden bg-zinc-200">
      {canTry ? (
        <Image
          src={imageUrl!}
          alt={podName}
          fill
          className="object-cover transition duration-500 ease-out group-hover:scale-[1.05]"
          sizes={sizes}
          onError={() => setLoadFailed(true)}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-950 text-3xl font-black text-zinc-500 sm:text-4xl"
          aria-hidden
        >
          {vendorInitials(podName)}
        </div>
      )}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"
        aria-hidden
      />
    </div>
  );
}

function PodCardBody({
  pod,
  isCompact,
  counts,
  cuisineLine,
  locationLine,
}: {
  pod: PodCardPod;
  isCompact: boolean;
  counts: ReturnType<typeof getPodVendorCounts>;
  cuisineLine: string | null;
  locationLine: string | null;
}) {
  return (
    <div className={isCompact ? "p-4" : "p-5 sm:p-6"}>
      <h2
        className={cn(
          "font-bold leading-snug text-oo-charcoal transition group-hover:text-oo-stone-gray",
          isCompact ? "line-clamp-2 text-base" : "text-xl sm:text-2xl"
        )}
      >
        {pod.name}
      </h2>
      {locationLine && (
        <p className="mt-1 line-clamp-1 text-sm text-oo-stone-gray">{locationLine}</p>
      )}
      <p className="mt-2 text-sm font-medium text-oo-charcoal">{formatPodVendorCountLine(counts)}</p>
      {cuisineLine && (
        <p className="mt-1 line-clamp-2 text-sm text-oo-stone-gray">{cuisineLine}</p>
      )}
      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">
        Pickup only
      </p>
    </div>
  );
}

export function PodCard({ pod, variant = "full", onSelectPod, isSelected }: PodCardProps) {
  const isCompact = variant === "compact";
  const counts = getPodVendorCounts(pod);
  const cuisineLine = formatPodCuisinePreviewLine(pod);
  const locationLine = pod.address?.trim() || null;

  const mediaSizes = isCompact
    ? "(max-width: 640px) 78vw, 304px"
    : "(max-width: 640px) 100vw, (max-width: 1280px) 33vw, 400px";

  const cardClass = cn(
    "group relative overflow-hidden rounded-xl border bg-oo-warm-white transition duration-300 motion-reduce:transform-none",
    isSelected
      ? "border-brand ring-2 ring-brand/30 shadow-md"
      : "border-oo-light-stone shadow-sm hover:-translate-y-1 hover:border-oo-stone-gray/30 hover:shadow-lg",
    isCompact && !isSelected && "w-full shadow-md hover:-translate-y-1 hover:shadow-xl"
  );

  const mediaBlock = (
    <div
      className={cn(
        "relative w-full overflow-hidden",
        isCompact ? "aspect-[4/3]" : "aspect-[16/10] sm:aspect-[5/3]"
      )}
    >
      <PodCardMedia imageUrl={pod.imageUrl} podName={pod.name} sizes={mediaSizes} />
      <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
        <span className="oo-badge-live shadow-lg">
          {counts.open > 0 ? "Open now" : "Closed"}
        </span>
      </div>
    </div>
  );

  const footerActions = (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 border-t border-oo-light-stone/80 px-4 py-3 sm:px-5",
        isCompact && "px-4"
      )}
    >
      {onSelectPod ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectPod(pod.id);
          }}
          className="text-sm font-semibold text-brand hover:underline"
        >
          Explore vendors
        </button>
      ) : null}
      <Link
        href={`/pod/${pod.id}`}
        onClick={(e) => e.stopPropagation()}
        className="text-sm font-semibold text-oo-charcoal hover:text-brand hover:underline"
      >
        View pod
      </Link>
    </div>
  );

  const inner = (
    <>
      {mediaBlock}
      <PodCardBody
        pod={pod}
        isCompact={isCompact}
        counts={counts}
        cuisineLine={cuisineLine}
        locationLine={locationLine}
      />
      {footerActions}
    </>
  );

  return (
    <div
      className={cardClass}
      style={
        pod.accentColor
          ? {
              borderLeftWidth: 4,
              borderLeftStyle: "solid",
              borderLeftColor: pod.accentColor,
            }
          : undefined
      }
    >
      {onSelectPod ? (
        <button
          type="button"
          onClick={() => onSelectPod(pod.id)}
          className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          {inner}
        </button>
      ) : (
        <Link href={`/pod/${pod.id}`} className="block outline-none">
          {inner}
        </Link>
      )}
      <FavoritePodButton
        podId={pod.id}
        podName={pod.name}
        className={cn(
          "absolute right-2 top-2 z-20 shadow-lg backdrop-blur-sm",
          isCompact ? "scale-90" : ""
        )}
      />
    </div>
  );
}

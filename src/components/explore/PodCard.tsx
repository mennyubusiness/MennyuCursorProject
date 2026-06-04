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
import { getPodPageHref } from "@/lib/explore-pod-navigation";
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

export function PodCard({ pod, variant = "full" }: PodCardProps) {
  const isCompact = variant === "compact";
  const counts = getPodVendorCounts(pod);
  const cuisineLine = formatPodCuisinePreviewLine(pod);
  const locationLine = pod.address?.trim() || null;
  const podHref = getPodPageHref(pod.id);

  const mediaSizes = isCompact
    ? "(max-width: 640px) 78vw, 304px"
    : "(max-width: 640px) 100vw, (max-width: 1280px) 33vw, 400px";

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-oo-light-stone bg-oo-warm-white shadow-sm transition duration-300 motion-reduce:transform-none",
        "hover:-translate-y-1 hover:border-oo-stone-gray/30 hover:shadow-lg",
        isCompact && "w-full shadow-md hover:-translate-y-1 hover:shadow-xl"
      )}
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
      <Link
        href={podHref}
        className="block outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
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
          <p className="mt-2 text-sm font-medium text-oo-charcoal">
            {formatPodVendorCountLine(counts)}
          </p>
          {cuisineLine && (
            <p className="mt-1 line-clamp-2 text-sm text-oo-stone-gray">{cuisineLine}</p>
          )}
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">
            Pickup only
          </p>
          <span
            className={cn(
              "mt-4 inline-flex items-center font-semibold text-brand transition group-hover:underline",
              isCompact ? "text-sm" : "text-sm"
            )}
          >
            View pod
          </span>
        </div>
      </Link>
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

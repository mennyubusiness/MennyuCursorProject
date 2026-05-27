"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { isHttpsImageUrl } from "@/lib/remote-image-url";
import { vendorInitials } from "@/lib/vendor-initials";
import { FavoritePodButton } from "@/components/retention/FavoritePodButton";
import { cn } from "@/lib/cn";

export type PodCardPod = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  accentColor: string | null;
  vendors: { vendor: { id: string; name: string; description: string | null } }[];
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
  const vendorCount = pod.vendors.length;
  const featuredVendorName = pod.vendors[0]?.vendor.name;
  const isCompact = variant === "compact";

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-oo-light-stone bg-oo-warm-white transition duration-300 motion-reduce:transform-none",
        isCompact
          ? "w-[min(19rem,78vw)] shrink-0 shadow-md hover:-translate-y-1 hover:shadow-xl"
          : "shadow-sm hover:-translate-y-1 hover:border-oo-stone-gray/30 hover:shadow-lg"
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
      <Link href={`/pod/${pod.id}`} className="block outline-none">
        <div
          className={cn(
            "relative w-full overflow-hidden",
            isCompact ? "aspect-[4/3]" : "aspect-[16/10] sm:aspect-[5/3]"
          )}
        >
          <PodCardMedia
            imageUrl={pod.imageUrl}
            podName={pod.name}
            sizes={
              isCompact
                ? "(max-width: 640px) 78vw, 304px"
                : "(max-width: 640px) 100vw, (max-width: 1280px) 33vw, 400px"
            }
          />
          <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
            <span className="oo-badge-live shadow-lg">{vendorCount} vendor{vendorCount !== 1 ? "s" : ""}</span>
            {!isCompact && vendorCount > 0 && (
              <span className="oo-badge border border-white/20 bg-white/10 text-white backdrop-blur-sm">
                Open
              </span>
            )}
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
          {!isCompact && pod.description && (
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-oo-stone-gray sm:text-base">
              {pod.description}
            </p>
          )}
          {!isCompact && featuredVendorName && (
            <p className="mt-3 line-clamp-1 text-xs font-medium uppercase tracking-wide text-oo-stone-gray">
              Featuring {featuredVendorName}
              {vendorCount > 1 ? ` +${vendorCount - 1}` : ""}
            </p>
          )}
          <span
            className={cn(
              "mt-4 inline-flex items-center font-semibold text-brand transition group-hover:underline",
              isCompact ? "text-xs" : "text-sm"
            )}
          >
            Start order →
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

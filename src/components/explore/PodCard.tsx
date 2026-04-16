"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { isHttpsImageUrl } from "@/lib/remote-image-url";
import { vendorInitials } from "@/lib/vendor-initials";
import { FavoritePodButton } from "@/components/retention/FavoritePodButton";

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
    <div className="relative h-full w-full overflow-hidden bg-stone-200">
      {canTry ? (
        <Image
          src={imageUrl!}
          alt={podName}
          fill
          className="object-cover transition duration-500 ease-out group-hover:scale-[1.04]"
          sizes={sizes}
          onError={() => setLoadFailed(true)}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-200 to-stone-300 text-3xl font-bold text-stone-500 sm:text-4xl"
          aria-hidden
        >
          {vendorInitials(podName)}
        </div>
      )}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 to-transparent opacity-80"
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
      className={`group relative overflow-hidden rounded-2xl border border-stone-200/90 bg-white ring-1 ring-black/[0.06] transition duration-300 motion-reduce:transform-none ${
        isCompact
          ? "w-[min(17rem,72vw)] shrink-0 shadow-md hover:-translate-y-0.5 hover:shadow-xl"
          : "shadow-lg hover:-translate-y-[2px] hover:shadow-2xl"
      }`}
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
      <Link href={`/pod/${pod.id}`} className="block outline-none transition active:scale-[0.99]">
        <div className="relative aspect-video w-full overflow-hidden">
          <PodCardMedia
            imageUrl={pod.imageUrl}
            podName={pod.name}
            sizes={isCompact ? "(max-width: 640px) 72vw, 272px" : "(max-width: 640px) 100vw, 380px"}
          />
        </div>

        <div className={isCompact ? "p-3.5" : "p-5 sm:p-6"}>
          <h2
            className={`font-semibold leading-snug text-stone-900 transition group-hover:text-stone-950 ${
              isCompact ? "line-clamp-2 text-sm" : "text-lg"
            }`}
          >
            {pod.name}
          </h2>
          {!isCompact && pod.description && (
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-stone-600">
              {pod.description}
            </p>
          )}
          <div
            className={`mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 ${isCompact ? "text-xs" : "text-sm"}`}
          >
            <span className="inline-flex items-center rounded-full bg-mennyu-primary px-2.5 py-0.5 font-semibold text-black shadow-sm">
              {vendorCount} vendor{vendorCount !== 1 ? "s" : ""}
            </span>
          </div>
          {!isCompact && featuredVendorName && (
            <p className="mt-2 line-clamp-2 text-xs text-stone-500">
              <span className="font-medium text-stone-600">Featuring</span> · {featuredVendorName}
              {vendorCount > 1 ? ` + ${vendorCount - 1} more` : ""}
            </p>
          )}
          <p
            className={`mt-4 inline-flex items-center rounded-lg font-semibold text-mennyu-primary ring-1 ring-mennyu-primary/35 transition group-hover:bg-mennyu-primary group-hover:text-black group-hover:ring-mennyu-primary ${
              isCompact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"
            }`}
          >
            Start order →
          </p>
        </div>
      </Link>
      <FavoritePodButton
        podId={pod.id}
        podName={pod.name}
        className={`absolute right-2 top-2 z-20 shadow-md backdrop-blur-sm ${isCompact ? "scale-90" : ""}`}
      />
    </div>
  );
}

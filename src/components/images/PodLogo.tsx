"use client";

import Image from "next/image";
import { useState } from "react";
import { isHttpsImageUrl } from "@/lib/remote-image-url";
import { vendorInitials } from "@/lib/vendor-initials";

const DEFAULT_BOX = "h-28 w-28 sm:h-36 sm:w-36";

type PodLogoProps = {
  imageUrl: string | null | undefined;
  podName: string;
  className?: string;
  sizes?: string;
};

export function PodLogo({
  imageUrl,
  podName,
  className = DEFAULT_BOX,
  sizes = "(max-width: 640px) 112px, 144px",
}: PodLogoProps) {
  const [loadFailed, setLoadFailed] = useState(false);
  const canTryImage = isHttpsImageUrl(imageUrl) && !loadFailed;

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 ${className}`}
    >
      {canTryImage ? (
        <Image
          src={imageUrl}
          alt={`${podName}`}
          fill
          className="object-cover"
          sizes={sizes}
          onError={() => setLoadFailed(true)}
        />
      ) : (
        <div
          className="flex h-full min-h-[7rem] w-full items-center justify-center text-2xl font-semibold text-stone-500 sm:min-h-[9rem]"
          aria-hidden
        >
          {vendorInitials(podName)}
        </div>
      )}
    </div>
  );
}

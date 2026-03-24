"use client";

import Image from "next/image";
import { useState } from "react";
import { isHttpsImageUrl } from "@/lib/remote-image-url";
import { vendorInitials } from "@/lib/vendor-initials";

const DEFAULT_BOX = "h-14 w-14";

type VendorLogoProps = {
  imageUrl: string | null | undefined;
  vendorName: string;
  /** Outer box (fixed size); image uses object-cover inside. */
  className?: string;
};

export function VendorLogo({ imageUrl, vendorName, className = DEFAULT_BOX }: VendorLogoProps) {
  const [loadFailed, setLoadFailed] = useState(false);
  const canTryImage = isHttpsImageUrl(imageUrl) && !loadFailed;

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-xl border border-stone-200 bg-stone-100 ${className}`}
    >
      {canTryImage ? (
        <Image
          src={imageUrl}
          alt={`${vendorName} logo`}
          fill
          className="object-cover"
          sizes="56px"
          onError={() => setLoadFailed(true)}
        />
      ) : (
        <div
          className="flex h-full min-h-[3.5rem] w-full items-center justify-center text-sm font-semibold text-stone-500"
          aria-hidden
        >
          {vendorInitials(vendorName)}
        </div>
      )}
    </div>
  );
}

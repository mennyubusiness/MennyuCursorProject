"use client";

import Image from "next/image";
import { useState } from "react";
import { isHttpsImageUrl } from "@/lib/remote-image-url";

const DEFAULT_BOX = "h-14 w-14 sm:h-16 sm:w-16";

type MenuItemImageProps = {
  imageUrl: string | null | undefined;
  itemName: string;
  className?: string;
};

export function MenuItemImage({ imageUrl, itemName, className = DEFAULT_BOX }: MenuItemImageProps) {
  const [loadFailed, setLoadFailed] = useState(false);
  const canTryImage = isHttpsImageUrl(imageUrl) && !loadFailed;

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-xl border border-dashed border-stone-200 bg-stone-50 ${className}`}
    >
      {canTryImage ? (
        <Image
          src={imageUrl}
          alt={itemName}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 56px, 64px"
          onError={() => setLoadFailed(true)}
        />
      ) : (
        <div
          className="flex h-full min-h-[3.5rem] w-full items-center justify-center text-[10px] font-medium uppercase tracking-wide text-stone-400 sm:min-h-[4rem]"
          aria-hidden
        >
          Photo
        </div>
      )}
    </div>
  );
}

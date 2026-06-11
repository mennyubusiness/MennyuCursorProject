import Image from "next/image";

import { BRAND, BRAND_ALT } from "@/lib/brand-assets";
import { cn } from "@/lib/cn";

/** Trimmed transparent asset intrinsic size (779×104 @ 1024 source). */
export const HERO_HORIZONTAL_LOGO_INTRINSIC = { width: 779, height: 104 } as const;

type HomeHeroBrandProps = {
  className?: string;
  priority?: boolean;
  /** Homepage hero uses the large treatment; other pages stay smaller. */
  size?: "homepage" | "default";
};

const SIZE_PRESETS = {
  homepage: {
    width: 1100,
    maxWidthClass: "max-w-[min(1100px,92%)]",
    sizes: "(min-width: 1024px) 1100px, (min-width: 640px) 90vw",
  },
  default: {
    width: 760,
    maxWidthClass: "max-w-[min(760px,85%)]",
    sizes: "(min-width: 640px) 760px",
  },
} as const;

/** Full horizontal logo on desktop; compact mark + name on small screens. */
export function HomeHeroBrand({
  className,
  priority = true,
  size = "default",
}: HomeHeroBrandProps) {
  const preset = SIZE_PRESETS[size];

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center gap-3 sm:hidden">
        <Image
          src={BRAND.mark}
          alt=""
          width={80}
          height={80}
          priority={priority}
          className="h-16 w-16 shrink-0 object-contain"
          aria-hidden
        />
        <p className="text-xl font-black tracking-tight text-oo-warm-white">
          <span className="sr-only">{BRAND_ALT.mark}</span>
          Open Order
        </p>
      </div>

      <Image
        src={BRAND.horizontalLogo}
        alt={BRAND_ALT.horizontalLogo}
        width={HERO_HORIZONTAL_LOGO_INTRINSIC.width}
        height={HERO_HORIZONTAL_LOGO_INTRINSIC.height}
        priority={priority}
        unoptimized
        className={cn(
          "hidden h-auto w-full object-contain sm:block",
          preset.maxWidthClass
        )}
        sizes={preset.sizes}
      />
    </div>
  );
}

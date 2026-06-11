import Image from "next/image";

import { BRAND, BRAND_ALT } from "@/lib/brand-assets";
import { cn } from "@/lib/cn";

type HomeHeroBrandProps = {
  className?: string;
  priority?: boolean;
};

const HORIZONTAL_DARK_BLEND =
  "mix-blend-screen [filter:drop-shadow(0_2px_12px_rgba(0,0,0,0.35))]";

/** Full horizontal logo on desktop; compact mark + name on small screens. */
export function HomeHeroBrand({ className, priority = true }: HomeHeroBrandProps) {
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
        width={760}
        height={200}
        priority={priority}
        className={cn(
          "hidden h-auto w-full max-w-[min(760px,80%)] object-contain sm:block",
          HORIZONTAL_DARK_BLEND
        )}
        sizes="(min-width: 640px) 760px"
      />
    </div>
  );
}

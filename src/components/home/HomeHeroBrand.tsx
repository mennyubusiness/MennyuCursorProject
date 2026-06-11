import Image from "next/image";

import { BRAND, BRAND_ALT } from "@/lib/brand-assets";
import { cn } from "@/lib/cn";

type HomeHeroBrandProps = {
  className?: string;
  priority?: boolean;
};

/** Full horizontal logo on desktop; compact mark + name on small screens. */
export function HomeHeroBrand({ className, priority = true }: HomeHeroBrandProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center gap-3 sm:hidden">
        <Image
          src={BRAND.headerLogo}
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
        className="hidden h-auto w-full max-w-[min(760px,80%)] object-contain sm:block"
        sizes="(min-width: 640px) 760px"
      />
    </div>
  );
}

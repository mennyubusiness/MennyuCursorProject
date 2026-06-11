import Image from "next/image";

import { BRAND, BRAND_ALT } from "@/lib/brand-assets";
import { cn } from "@/lib/cn";

type HomeHeroBrandProps = {
  className?: string;
  priority?: boolean;
};

/** Large OO mark + company name for the marketing homepage hero. */
export function HomeHeroBrand({ className, priority = true }: HomeHeroBrandProps) {
  return (
    <div className={cn("flex flex-col items-start gap-3 sm:gap-4", className)}>
      <Image
        src={BRAND.mark}
        alt=""
        width={160}
        height={160}
        priority={priority}
        className="h-[5.5rem] w-[5.5rem] object-contain sm:h-32 sm:w-32 lg:h-40 lg:w-40"
        aria-hidden
      />
      <p className="text-xl font-black tracking-tight text-oo-warm-white sm:text-2xl">
        <span className="sr-only">{BRAND_ALT.mark}</span>
        Open Order
      </p>
    </div>
  );
}

import Image from "next/image";
import Link from "next/link";
import { BRAND, BRAND_ALT, HORIZONTAL_LOGO_INTRINSIC, MARK_INTRINSIC } from "@/lib/brand-assets";
import { cn } from "@/lib/cn";

export type OpenOrderLogoVariant =
  | "header"
  | "mark"
  | "mark-with-label"
  | "horizontal"
  | "horizontal-light"
  | "seal";

type OpenOrderLogoProps = {
  variant?: OpenOrderLogoVariant;
  href?: string;
  className?: string;
  priority?: boolean;
};

const MARK_SIZE = MARK_INTRINSIC;

export function OpenOrderLogo({
  variant = "header",
  href = "/",
  className,
  priority = false,
}: OpenOrderLogoProps) {
  const inner = (() => {
    if (variant === "header" || variant === "mark") {
      return (
        <Image
          src={BRAND.mark}
          alt={BRAND_ALT.mark}
          width={MARK_SIZE.width}
          height={MARK_SIZE.height}
          className="h-10 w-10 shrink-0 object-contain sm:h-12 sm:w-12"
          priority={priority}
          unoptimized
        />
      );
    }

    if (variant === "mark-with-label") {
      return (
        <>
          <Image
            src={BRAND.mark}
            alt=""
            width={MARK_SIZE.width}
            height={MARK_SIZE.height}
            className="h-10 w-10 shrink-0 object-contain sm:h-12 sm:w-12"
            priority={priority}
            unoptimized
            aria-hidden
          />
          <span className="hidden text-base font-semibold tracking-tight text-oo-warm-white sm:inline">
            Open Order
          </span>
        </>
      );
    }

    if (variant === "horizontal") {
      return (
        <Image
          src={BRAND.horizontalLogo}
          alt={BRAND_ALT.horizontalLogo}
          width={HORIZONTAL_LOGO_INTRINSIC.width}
          height={HORIZONTAL_LOGO_INTRINSIC.height}
          className="h-auto w-full max-w-[220px] object-contain object-left sm:max-w-[260px]"
          priority={priority}
          unoptimized
        />
      );
    }

    if (variant === "horizontal-light") {
      return (
        <Image
          src={BRAND.horizontalLogoLight}
          alt={BRAND_ALT.horizontalLogoLight}
          width={320}
          height={84}
          className="h-auto w-full max-w-[220px] object-contain sm:max-w-[280px]"
          priority={priority}
        />
      );
    }

    return (
      <Image
        src={BRAND.seal}
        alt={BRAND_ALT.seal}
        width={320}
        height={320}
        className="h-auto w-full max-w-[18rem] object-contain"
        priority={priority}
      />
    );
  })();

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oo-warm-white",
        className
      )}
      aria-label={BRAND_ALT.mark}
    >
      {inner}
    </Link>
  );
}

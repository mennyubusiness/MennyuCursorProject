import Image from "next/image";
import Link from "next/link";
import { BRAND, BRAND_ALT } from "@/lib/brand-assets";
import { cn } from "@/lib/cn";

export type OpenOrderLogoVariant =
  | "header"
  | "mark"
  | "mark-with-label"
  | "wordmark"
  | "seal";

type OpenOrderLogoProps = {
  variant?: OpenOrderLogoVariant;
  href?: string;
  className?: string;
  priority?: boolean;
};

const HEADER_LOGO_SIZE = { width: 56, height: 56 };

export function OpenOrderLogo({
  variant = "header",
  href = "/",
  className,
  priority = false,
}: OpenOrderLogoProps) {
  const inner = (() => {
    if (variant === "header" || variant === "mark" || variant === "mark-with-label") {
      return (
        <Image
          src={BRAND.headerLogo}
          alt={BRAND_ALT.mark}
          width={HEADER_LOGO_SIZE.width}
          height={HEADER_LOGO_SIZE.height}
          className="h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14"
          priority={priority}
        />
      );
    }

    if (variant === "wordmark") {
      return (
        <Image
          src={BRAND.wordmark}
          alt={BRAND_ALT.wordmark}
          width={280}
          height={80}
          className="h-auto w-auto max-h-12 max-w-[min(100%,280px)] object-contain"
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
        "inline-flex shrink-0 items-center transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oo-warm-white",
        className
      )}
      aria-label={BRAND_ALT.mark}
    >
      {inner}
    </Link>
  );
}

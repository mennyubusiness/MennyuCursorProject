"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { StartGroupOrderButton } from "@/components/cart/StartGroupOrderButton";
import { useQuickCartOptional } from "@/components/cart/QuickCartContext";
import { buttonClassName } from "@/components/ui/button";

type StartProps = {
  podId: string;
  /** No-JS / crawl fallback — redirect cart start URL. */
  fallbackHref: string;
  size?: "sm" | "md";
  className?: string;
};

export function PodPageStartGroupOrderButton({
  podId,
  fallbackHref,
  size = "sm",
  className,
}: StartProps) {
  const quickCart = useQuickCartOptional();
  const router = useRouter();
  const buttonClass = className ?? buttonClassName({
    variant: "primary",
    size,
    className: "shrink-0 self-start sm:self-center",
  });

  return (
    <>
      <StartGroupOrderButton
        podId={podId}
        className={buttonClass}
        onStarted={() => {
          quickCart?.openCart();
          router.refresh();
        }}
      />
      <noscript>
        <Link href={fallbackHref} className={buttonClass}>
          Start group order
        </Link>
      </noscript>
    </>
  );
}

export function PodPageOpenQuickCartButton({
  label = "Open group cart",
  variant = "secondary",
  size = "sm",
  className,
}: {
  label?: string;
  variant?: "primary" | "secondary";
  size?: "sm" | "md";
  className?: string;
}) {
  const quickCart = useQuickCartOptional();

  return (
    <button
      type="button"
      onClick={() => quickCart?.openCart()}
      className={
        className ??
        buttonClassName({
          variant,
          size,
          className: "shrink-0 self-start sm:self-center",
        })
      }
    >
      {label}
    </button>
  );
}

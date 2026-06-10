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
};

export function PodPageStartGroupOrderButton({ podId, fallbackHref }: StartProps) {
  const quickCart = useQuickCartOptional();
  const router = useRouter();

  return (
    <>
      <StartGroupOrderButton
        podId={podId}
        className={buttonClassName({
          variant: "primary",
          size: "sm",
          className: "shrink-0 self-start sm:self-center",
        })}
        onStarted={() => {
          quickCart?.openCart();
          router.refresh();
        }}
      />
      <noscript>
        <Link
          href={fallbackHref}
          className={buttonClassName({
            variant: "primary",
            size: "sm",
            className: "shrink-0 self-start sm:self-center",
          })}
        >
          Start group order
        </Link>
      </noscript>
    </>
  );
}

export function PodPageOpenQuickCartButton({
  label = "Open group cart",
  variant = "secondary",
}: {
  label?: string;
  variant?: "primary" | "secondary";
}) {
  const quickCart = useQuickCartOptional();

  return (
    <button
      type="button"
      onClick={() => quickCart?.openCart()}
      className={buttonClassName({
        variant,
        size: "sm",
        className: "shrink-0 self-start sm:self-center",
      })}
    >
      {label}
    </button>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ComponentProps, type MouseEvent } from "react";
import { flushAllCartWork } from "@/lib/cart-sync-scheduler";

type AwaitCartNavigationLinkProps = Omit<ComponentProps<typeof Link>, "onClick"> & {
  cartId?: string | null;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  /** Called after navigation is requested (e.g. close drawer once route takes over). */
  onNavigating?: () => void;
  loadingLabel?: string;
};

/**
 * Navigates to cart/checkout only after pending cart mutations finish (no stale SSR cart).
 * Shows immediate loading feedback so View Cart never feels unresponsive.
 */
export function AwaitCartNavigationLink({
  cartId,
  href,
  onClick,
  onNavigating,
  children,
  loadingLabel = "Opening cart…",
  className,
  ...rest
}: AwaitCartNavigationLinkProps) {
  const router = useRouter();
  const [navigating, setNavigating] = useState(false);
  const target = typeof href === "string" ? href : href.pathname ?? "/cart";

  useEffect(() => {
    try {
      router.prefetch(target);
    } catch {
      // Prefetch is best-effort.
    }
  }, [router, target]);

  return (
    <Link
      href={href}
      {...rest}
      aria-busy={navigating || undefined}
      aria-disabled={navigating || undefined}
      className={[
        className,
        navigating ? "pointer-events-none opacity-90" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        event.preventDefault();
        if (navigating) return;

        setNavigating(true);
        void flushAllCartWork(cartId)
          .then(() => {
            onNavigating?.();
            router.push(target);
          })
          .catch(() => {
            setNavigating(false);
          });
      }}
    >
      {navigating ? (
        <span className="inline-flex items-center justify-center gap-2">
          <span
            className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
            aria-hidden
          />
          <span>{loadingLabel}</span>
        </span>
      ) : (
        children
      )}
    </Link>
  );
}

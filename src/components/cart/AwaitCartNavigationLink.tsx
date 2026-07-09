"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, MouseEvent } from "react";
import { flushAllCartWork } from "@/lib/cart-sync-scheduler";

type AwaitCartNavigationLinkProps = Omit<ComponentProps<typeof Link>, "onClick"> & {
  cartId?: string | null;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

/**
 * Navigates to cart/checkout only after pending cart mutations finish (no stale SSR cart).
 */
export function AwaitCartNavigationLink({
  cartId,
  href,
  onClick,
  children,
  ...rest
}: AwaitCartNavigationLinkProps) {
  const router = useRouter();

  return (
    <Link
      href={href}
      {...rest}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        event.preventDefault();
        const target = typeof href === "string" ? href : href.pathname ?? "/cart";
        void flushAllCartWork(cartId).then(() => {
          router.push(target);
        });
      }}
    >
      {children}
    </Link>
  );
}

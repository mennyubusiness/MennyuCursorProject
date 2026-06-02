"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AccountHeaderDropdown } from "@/components/AccountHeaderDropdown";
import type { HeaderAccountMenu } from "@/lib/auth/header-account-menu";
import type { HeaderNavMode } from "@/lib/auth/header-nav-types";
import { HeaderSignInLink } from "@/components/HeaderSignInLink";
import { buttonClassName } from "@/components/ui/button";
import { useQuickCartOptional } from "@/components/cart/QuickCartContext";
import { cn } from "@/lib/cn";

type SiteHeaderNavProps = {
  hasServerSession: boolean;
  navMode: HeaderNavMode;
  accountMenu: HeaderAccountMenu | null;
  activeOrderHref: string | null;
  cartHref: string;
};

const navPillClass =
  "flex flex-wrap items-center justify-end gap-0.5 rounded-full border border-[#E7E0D6] bg-[#FFFDF8]/95 px-1.5 py-1 shadow-sm backdrop-blur-md sm:gap-1 sm:px-2 sm:py-1.5";

const navLink =
  "rounded-md px-2.5 py-1.5 text-sm font-medium text-[#1F1F1C] transition-colors duration-200 hover:bg-[#FAF4EA] hover:text-[#1F1F1C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:text-[0.9375rem]";

export function SiteHeaderNav({
  hasServerSession,
  navMode,
  accountMenu,
  activeOrderHref,
  cartHref,
}: SiteHeaderNavProps) {
  const quickCart = useQuickCartOptional();
  const [cartPulse, setCartPulse] = useState(false);

  useEffect(() => {
    let clearTimer: ReturnType<typeof setTimeout> | undefined;
    const onCartAdded = () => {
      setCartPulse(true);
      if (clearTimer) clearTimeout(clearTimer);
      clearTimer = setTimeout(() => setCartPulse(false), 650);
    };
    window.addEventListener("mennyu:cart-added", onCartAdded);
    return () => {
      window.removeEventListener("mennyu:cart-added", onCartAdded);
      if (clearTimer) clearTimeout(clearTimer);
    };
  }, []);

  const isSignedIn = hasServerSession;
  const showCustomerOrdering = navMode === "guest" || navMode === "customer";
  const showCart = showCustomerOrdering || isSignedIn;

  return (
    <nav className="flex flex-wrap items-center justify-end" aria-label="Site">
      <div className={navPillClass}>
        <Link href="/explore" className={navLink}>
          Explore
        </Link>
        {showCart && (
          <>
            {quickCart?.enabled ? (
              <button
                type="button"
                onClick={quickCart.openCart}
                className={cn(
                  buttonClassName({ variant: "primary", size: "sm" }),
                  "relative ml-0.5 shadow-[0_0_12px_rgba(249,115,22,0.3)]",
                  cartPulse && "animate-mennyu-cart-nudge motion-reduce:animate-none"
                )}
                title="Open your cart"
                aria-label={
                  quickCart.itemCount > 0
                    ? `Open cart, ${quickCart.itemCount} items`
                    : "Open cart"
                }
              >
                Cart
                {quickCart.itemCount > 0 && (
                  <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold tabular-nums leading-none">
                    {quickCart.itemCount > 99 ? "99+" : quickCart.itemCount}
                  </span>
                )}
              </button>
            ) : (
              <Link
                href={activeOrderHref ?? cartHref}
                className={cn(
                  buttonClassName({ variant: "primary", size: "sm" }),
                  "ml-0.5 shadow-[0_0_12px_rgba(249,115,22,0.3)]",
                  cartPulse && "animate-mennyu-cart-nudge motion-reduce:animate-none"
                )}
                title="Your cart"
              >
                Cart
              </Link>
            )}
          </>
        )}
        {isSignedIn ? (
          <AccountHeaderDropdown
            accountMenu={accountMenu}
            hasServerSession={hasServerSession}
            triggerClassName={navLink}
          />
        ) : (
          <HeaderSignInLink className={navLink} title="Sign in" />
        )}
      </div>
    </nav>
  );
}

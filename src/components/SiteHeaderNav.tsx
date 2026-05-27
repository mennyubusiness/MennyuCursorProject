"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

import type { HeaderNavMode } from "@/lib/auth/header-nav-types";
import { buttonClassName } from "@/components/ui/button";
import { useQuickCartOptional } from "@/components/cart/QuickCartContext";
import { cn } from "@/lib/cn";

type SiteHeaderNavProps = {
  callbackPath: string;
  customerPhone: string | null;
  hasServerSession: boolean;
  navMode: HeaderNavMode;
  dashboardHref: string | null;
  accountLabel: string | null;
  activeOrderHref: string | null;
  cartHref: string;
};

function buildLoginHref(callbackPath: string): string {
  const safe =
    callbackPath && callbackPath.startsWith("/") && !callbackPath.startsWith("//")
      ? callbackPath
      : "/";
  const q = new URLSearchParams();
  q.set("callbackUrl", safe);
  return `/login?${q.toString()}`;
}

const navPillClass =
  "flex flex-wrap items-center justify-end gap-0.5 rounded-full border border-[#E7E0D6] bg-[#FFFDF8]/95 px-1.5 py-1 shadow-sm backdrop-blur-md sm:gap-1 sm:px-2 sm:py-1.5";

const navLink =
  "rounded-md px-2.5 py-1.5 text-sm font-medium text-[#1F1F1C] transition-colors duration-200 hover:bg-[#FAF4EA] hover:text-[#1F1F1C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:text-[0.9375rem]";

export function SiteHeaderNav({
  callbackPath,
  customerPhone,
  hasServerSession,
  navMode,
  dashboardHref,
  accountLabel,
  activeOrderHref,
  cartHref,
}: SiteHeaderNavProps) {
  const router = useRouter();
  const { status } = useSession();
  const quickCart = useQuickCartOptional();
  const [signingOut, setSigningOut] = useState(false);
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

  const hasPhoneSession = Boolean(customerPhone);
  const hasNextAuthSession = hasServerSession || status === "authenticated";
  const isSignedIn = hasPhoneSession || hasNextAuthSession;

  const loginHref = buildLoginHref(callbackPath);

  const showCustomerOrdering = navMode === "guest" || navMode === "customer";
  const showDashboard =
    (navMode === "vendor" || navMode === "pod" || navMode === "admin") &&
    Boolean(dashboardHref);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await fetch("/api/orders/clear-phone", { method: "POST" });
      if (hasServerSession || status === "authenticated") {
        await signOut({ callbackUrl: "/" });
        return;
      }
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }, [hasServerSession, router, status]);

  return (
    <nav className="flex flex-wrap items-center justify-end" aria-label="Site">
      <div className={navPillClass}>
        {isSignedIn && accountLabel && (
          <span
            className="mr-0.5 hidden max-w-[8rem] truncate rounded-full border border-oo-light-stone bg-oo-cream/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-oo-stone-gray sm:inline"
            title="Signed-in account type"
          >
            {accountLabel}
          </span>
        )}
        <Link href="/explore" className={navLink}>
          Explore
        </Link>
        {showDashboard && dashboardHref && (
          <Link href={dashboardHref} className={navLink} title="Your dashboard">
            Dashboard
          </Link>
        )}
        {showCustomerOrdering && (
          <>
            <Link href="/orders" className={navLink} title="Your order history">
              Orders
            </Link>
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
        {!isSignedIn && (
          <Link href={loginHref} className={navLink} title="Sign in or create an account">
            Sign in
          </Link>
        )}
        {isSignedIn && (
          <button
            type="button"
            disabled={signingOut}
            onClick={() => void handleSignOut()}
            className={cn(navLink, "disabled:opacity-50")}
            title="Sign out"
          >
            {signingOut ? "…" : "Sign out"}
          </button>
        )}
        <Link
          href="/admin"
          className={cn(navLink, "hidden text-xs font-semibold uppercase tracking-wider sm:inline")}
          title="Platform admin"
        >
          Admin
        </Link>
      </div>
    </nav>
  );
}

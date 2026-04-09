"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

import type { HeaderNavMode } from "@/lib/auth/header-nav-types";

type SiteHeaderNavProps = {
  /** Path for login callback (usually current path from middleware). */
  callbackPath: string;
  customerPhone: string | null;
  /** Server snapshot: user has a NextAuth session (vendor/admin). */
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
    <nav className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 text-sm sm:gap-x-6 sm:text-base">
      {isSignedIn && accountLabel && (
        <span
          className="max-w-[8rem] shrink-0 truncate rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600"
          title="Signed-in account type"
        >
          {accountLabel}
        </span>
      )}
      <Link
        href="/explore"
        className="rounded-md text-stone-600 transition-colors duration-200 hover:text-mennyu-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mennyu-primary"
      >
        Explore pods
      </Link>
      {showDashboard && dashboardHref && (
        <Link
          href={dashboardHref}
          className="font-medium text-mennyu-primary hover:underline"
          title="Your restaurant or pod dashboard"
        >
          Dashboard
        </Link>
      )}
      {showCustomerOrdering && (
        <>
          <Link
            href="/orders"
            className="rounded-md text-stone-600 transition-colors duration-200 hover:text-mennyu-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mennyu-primary"
            title="Your orders — link your phone from checkout to see history"
          >
            Orders
          </Link>
          <Link
            href={activeOrderHref ?? cartHref}
            className={`rounded-md text-stone-600 transition hover:text-mennyu-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mennyu-primary ${
              cartPulse ? "animate-mennyu-cart-nudge motion-reduce:animate-none" : ""
            }`}
            title="Your cart"
          >
            Cart
          </Link>
        </>
      )}
      {!isSignedIn && (
        <Link
          href={loginHref}
          className="font-medium text-mennyu-primary hover:underline"
          title="Email sign-in. New accounts can be created from the login page."
        >
          Sign in
        </Link>
      )}
      {isSignedIn && (
        <button
          type="button"
          disabled={signingOut}
          onClick={() => void handleSignOut()}
          className="text-stone-600 hover:text-mennyu-primary disabled:opacity-50"
          title="Clears saved phone for orders and signs out email if you used one"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      )}
      <Link href="/admin" className="text-stone-500 hover:text-mennyu-primary">
        Admin
      </Link>
    </nav>
  );
}

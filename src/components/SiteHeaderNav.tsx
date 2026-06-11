"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { AccountHeaderDropdown } from "@/components/AccountHeaderDropdown";
import type { HeaderAccountMenu } from "@/lib/auth/header-account-menu";
import type { HeaderNavMode } from "@/lib/auth/header-nav-types";
import { HeaderSignInLink } from "@/components/HeaderSignInLink";
import { buttonClassName } from "@/components/ui/button";
import { useQuickCartOptional } from "@/components/cart/QuickCartContext";
import { HOME_PRIMARY_CTA_LABEL, homePodOwnerMailtoHref } from "@/lib/home-marketing";
import { isSiteNavLinkActive, SITE_NAV_LINKS } from "@/lib/site-nav";
import { cn } from "@/lib/cn";

type SiteHeaderNavProps = {
  hasServerSession: boolean;
  navMode: HeaderNavMode;
  accountMenu: HeaderAccountMenu | null;
  activeOrderHref: string | null;
  cartHref: string;
};

const navPill =
  "inline-flex items-center gap-0.5 rounded-full border border-oo-warm-white/15 bg-oo-charcoal/55 px-1 py-1 shadow-[inset_0_1px_0_rgba(255,253,248,0.06)] backdrop-blur-md";

const navLinkBase =
  "rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oo-warm-white sm:text-[0.9375rem]";

const navLinkIdle = "text-oo-cream/85 hover:bg-oo-warm-white/10 hover:text-oo-warm-white";

const navLinkActive =
  "bg-oo-warm-white/12 font-semibold text-oo-warm-white shadow-[inset_0_0_0_1px_rgba(255,253,248,0.1)] ring-1 ring-inset ring-brand/30";

const headerSecondaryButton =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-oo-warm-white/20 bg-oo-charcoal/50 px-3.5 py-2 text-sm font-medium text-oo-warm-white shadow-[inset_0_1px_0_rgba(255,253,248,0.05)] backdrop-blur-sm transition-colors duration-200 hover:border-oo-warm-white/30 hover:bg-oo-charcoal/65 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oo-warm-white";

const headerPrimaryCta = cn(
  buttonClassName({ variant: "primary", size: "sm" }),
  "h-10 min-h-10 whitespace-nowrap px-4 shadow-[0_0_16px_rgba(249,115,22,0.28)]"
);

const mobileNavLinkBase =
  "block rounded-lg px-4 py-3 text-base font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oo-warm-white";

const mobileNavLinkIdle = "text-oo-cream/90 hover:bg-oo-warm-white/8 hover:text-oo-warm-white";

const mobileNavLinkActive =
  "bg-oo-warm-white/10 font-semibold text-oo-warm-white ring-1 ring-inset ring-brand/25";

function NavLink({
  href,
  label,
  pathname,
  onNavigate,
  className,
  mobile = false,
}: {
  href: string;
  label: string;
  pathname: string;
  onNavigate?: () => void;
  className?: string;
  mobile?: boolean;
}) {
  const active = isSiteNavLinkActive(pathname, href);

  if (mobile) {
    return (
      <Link
        href={href}
        onClick={onNavigate}
        className={cn(
          mobileNavLinkBase,
          active ? mobileNavLinkActive : mobileNavLinkIdle,
          className
        )}
        aria-current={active ? "page" : undefined}
      >
        {label}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(navLinkBase, active ? navLinkActive : navLinkIdle, className)}
      aria-current={active ? "page" : undefined}
    >
      {label}
    </Link>
  );
}

function CartControl({
  cartHref,
  activeOrderHref,
  cartPulse,
  prominent,
  className,
  onNavigate,
  mobile = false,
}: {
  cartHref: string;
  activeOrderHref: string | null;
  cartPulse: boolean;
  prominent: boolean;
  className?: string;
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  const quickCart = useQuickCartOptional();
  const canOpenQuickCart = Boolean(quickCart?.enabled || quickCart?.hasActiveGroupOrder);
  const itemCount = quickCart?.itemCount ?? 0;

  const cartLabel =
    itemCount > 0 ? `Cart, ${itemCount} item${itemCount === 1 ? "" : "s"}` : "Cart";

  const sharedClass = cn(
    prominent
      ? cn(
          buttonClassName({ variant: "primary", size: mobile ? "md" : "sm" }),
          "relative shadow-[0_0_12px_rgba(249,115,22,0.3)]",
          !mobile && "h-10 min-h-10",
          cartPulse && "animate-mennyu-cart-nudge motion-reduce:animate-none"
        )
      : cn(headerSecondaryButton, mobile && "w-full justify-start px-4", className),
    !prominent && cartPulse && "border-brand/40 text-oo-warm-white"
  );

  if (canOpenQuickCart) {
    return (
      <button
        type="button"
        onClick={() => {
          quickCart?.openCart();
          onNavigate?.();
        }}
        className={sharedClass}
        title="Open your cart"
        aria-label={itemCount > 0 ? `Open cart, ${itemCount} items` : "Open cart"}
      >
        Cart
        {prominent && itemCount > 0 && (
          <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold tabular-nums leading-none">
            {itemCount > 99 ? "99+" : itemCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <Link
      href={activeOrderHref ?? cartHref}
      onClick={onNavigate}
      className={sharedClass}
      title="Your cart"
      aria-label={cartLabel}
    >
      Cart
      {prominent && itemCount > 0 && (
        <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold tabular-nums leading-none">
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      )}
    </Link>
  );
}

export function SiteHeaderNav({
  hasServerSession,
  navMode,
  accountMenu,
  activeOrderHref,
  cartHref,
}: SiteHeaderNavProps) {
  const pathname = usePathname();
  const quickCart = useQuickCartOptional();
  const [cartPulse, setCartPulse] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

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

  useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const isSignedIn = hasServerSession;
  const showCustomerOrdering = navMode === "guest" || navMode === "customer";
  const showCart = showCustomerOrdering || isSignedIn;
  const cartItemCount = quickCart?.itemCount ?? 0;
  const prominentCart = cartItemCount > 0 || Boolean(quickCart?.hasActiveGroupOrder);

  const businessCtaHref = homePodOwnerMailtoHref();

  return (
    <>
      <nav className="flex min-w-0 flex-1 items-center justify-end gap-3 lg:justify-between" aria-label="Site">
        <div className={cn(navPill, "hidden lg:inline-flex")}>
          {SITE_NAV_LINKS.map((link) => (
            <NavLink key={link.href} href={link.href} label={link.label} pathname={pathname} />
          ))}
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <a href={businessCtaHref} className={headerPrimaryCta}>
            {HOME_PRIMARY_CTA_LABEL}
          </a>
          {isSignedIn ? (
            <AccountHeaderDropdown
              accountMenu={accountMenu}
              hasServerSession={hasServerSession}
              triggerClassName={headerSecondaryButton}
            />
          ) : (
            <HeaderSignInLink className={headerSecondaryButton} title="Sign in" />
          )}
          {showCart && (
            <CartControl
              cartHref={cartHref}
              activeOrderHref={activeOrderHref}
              cartPulse={cartPulse}
              prominent={prominentCart}
            />
          )}
        </div>

        <button
          type="button"
          className={cn(
            headerSecondaryButton,
            "h-10 w-10 min-w-10 p-0 lg:hidden",
            mobileOpen && "border-oo-warm-white/30 bg-oo-charcoal/65"
          )}
          aria-expanded={mobileOpen}
          aria-controls="site-mobile-menu"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileOpen((open) => !open)}
        >
          <span className="sr-only">{mobileOpen ? "Close menu" : "Open menu"}</span>
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            {mobileOpen ? (
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            ) : (
              <>
                <path strokeLinecap="round" d="M4 7h16" />
                <path strokeLinecap="round" d="M4 12h16" />
                <path strokeLinecap="round" d="M4 17h16" />
              </>
            )}
          </svg>
        </button>
      </nav>

      {mobileOpen && (
        <div
          id="site-mobile-menu"
          className="fixed inset-x-0 top-16 z-40 max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-oo-warm-white/15 bg-oo-charcoal/95 shadow-[0_16px_48px_rgba(31,31,28,0.35)] backdrop-blur-xl sm:top-[4.25rem] lg:hidden"
        >
          <div className="oo-shell flex flex-col gap-1 py-4">
            {SITE_NAV_LINKS.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                label={link.label}
                pathname={pathname}
                onNavigate={closeMobile}
                mobile
              />
            ))}

            <div className="my-3 border-t border-oo-warm-white/10" />

            <div className="flex flex-col gap-2 px-1">
              {isSignedIn ? (
                <AccountHeaderDropdown
                  accountMenu={accountMenu}
                  hasServerSession={hasServerSession}
                  triggerClassName={cn(headerSecondaryButton, "w-full justify-start px-4")}
                />
              ) : (
                <HeaderSignInLink
                  className={cn(headerSecondaryButton, "w-full justify-start px-4")}
                  title="Sign in"
                />
              )}

              {showCart && (
                <CartControl
                  cartHref={cartHref}
                  activeOrderHref={activeOrderHref}
                  cartPulse={cartPulse}
                  prominent={prominentCart}
                  mobile
                  onNavigate={closeMobile}
                />
              )}
            </div>

            <a
              href={businessCtaHref}
              className={cn(buttonClassName({ variant: "primary", size: "md" }), "mx-1 mt-4")}
              onClick={closeMobile}
            >
              {HOME_PRIMARY_CTA_LABEL}
            </a>
          </div>
        </div>
      )}
    </>
  );
}

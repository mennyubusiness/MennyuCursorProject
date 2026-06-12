"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { AccountHeaderDropdown } from "@/components/AccountHeaderDropdown";
import { MobileAccountNavSection } from "@/components/account/MobileAccountNavSection";
import type { HeaderAccountMenu } from "@/lib/auth/header-account-menu";
import type { HeaderNavMode } from "@/lib/auth/header-nav-types";
import { HeaderSignInLink } from "@/components/HeaderSignInLink";
import { buttonClassName } from "@/components/ui/button";
import { useQuickCartOptional } from "@/components/cart/QuickCartContext";
import { HOME_PRIMARY_CTA_LABEL, homePodOwnerMailtoHref } from "@/lib/home-marketing";
import { isSiteNavLinkActive } from "@/lib/site-nav";
import { buildRoleNavConfig, shouldShowHeaderCart } from "@/lib/auth/role-nav-items";
import { cn } from "@/lib/cn";

type SiteHeaderNavProps = {
  hasServerSession: boolean;
  navMode: HeaderNavMode;
  accountMenu: HeaderAccountMenu | null;
  dashboardHref: string | null;
  activeOrderHref: string | null;
  cartHref: string;
};

const MOBILE_MENU_TOP = "top-16 sm:top-[4.25rem]";
const MOBILE_MENU_MAX_H = "max-h-[calc(100dvh-4rem)] sm:max-h-[calc(100dvh-4.25rem)]";

const headerFocusVisible =
  "outline-none focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

const creamPillBase = "border border-oo-light-stone/70 bg-oo-warm-white shadow-sm";

const navPill = cn(creamPillBase, "inline-flex items-center gap-0.5 rounded-full px-1 py-1");

const navLinkBase = cn(
  "rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-200 sm:text-[0.9375rem]",
  headerFocusVisible
);

const navLinkIdle = "text-oo-charcoal hover:bg-oo-cream hover:text-oo-charcoal";

const navLinkActive =
  "bg-oo-charcoal font-semibold text-oo-warm-white hover:bg-oo-charcoal hover:text-oo-warm-white";

const headerSecondaryButton = cn(
  creamPillBase,
  headerFocusVisible,
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium text-oo-charcoal transition-colors duration-200 hover:border-oo-light-stone hover:bg-oo-cream"
);

const headerPrimaryCta = cn(
  buttonClassName({ variant: "primary", size: "sm" }),
  headerFocusVisible,
  "h-10 min-h-10 whitespace-nowrap px-4 shadow-[0_0_16px_rgba(249,115,22,0.28)]"
);

const mobileNavRowBase = cn(
  "flex min-h-11 items-center rounded-xl px-4 py-2.5 text-base font-medium transition-colors duration-200",
  headerFocusVisible
);

const mobileNavRowIdle = "text-oo-charcoal hover:bg-oo-cream";

const mobileNavRowActive =
  "bg-oo-charcoal font-semibold text-oo-warm-white hover:bg-oo-charcoal hover:text-oo-warm-white";

const mobileMenuToggleIdle = cn(headerSecondaryButton, "h-10 w-10 min-w-10 p-0 lg:hidden");

const mobileMenuToggleOpen = cn(
  headerFocusVisible,
  "relative z-[100] inline-flex h-10 w-10 min-w-10 items-center justify-center rounded-full border border-oo-light-stone bg-oo-warm-white text-oo-charcoal shadow-sm lg:hidden"
);

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
          mobileNavRowBase,
          active ? mobileNavRowActive : mobileNavRowIdle,
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

  const desktopClass = cn(
    prominent
      ? cn(
          buttonClassName({ variant: "primary", size: "sm" }),
          headerFocusVisible,
          "relative h-10 min-h-10 shadow-[0_0_12px_rgba(249,115,22,0.3)]",
          cartPulse && "animate-mennyu-cart-nudge motion-reduce:animate-none"
        )
      : cn(headerSecondaryButton, className),
    !prominent && cartPulse && "border-brand/50 bg-oo-warm-white"
  );

  const mobileClass = cn(
    mobileNavRowBase,
    mobileNavRowIdle,
    "w-full justify-between",
    (prominent || itemCount > 0) && "font-semibold",
    cartPulse && "border-brand/50 bg-oo-cream",
    className
  );

  const sharedClass = mobile ? mobileClass : desktopClass;

  const countBadge =
    itemCount > 0 ? (
      <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-oo-charcoal px-1.5 py-0.5 text-[10px] font-bold tabular-nums leading-none text-oo-warm-white">
        {itemCount > 99 ? "99+" : itemCount}
      </span>
    ) : null;

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
        <span>Cart</span>
        {mobile ? countBadge : prominent && itemCount > 0 ? countBadge : null}
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
      <span>Cart</span>
      {mobile ? countBadge : prominent && itemCount > 0 ? countBadge : null}
    </Link>
  );
}

export function SiteHeaderNav({
  hasServerSession,
  navMode,
  accountMenu,
  dashboardHref,
  activeOrderHref,
  cartHref,
}: SiteHeaderNavProps) {
  const pathname = usePathname();
  const quickCart = useQuickCartOptional();
  const [cartPulse, setCartPulse] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuPortalReady, setMenuPortalReady] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    setMenuPortalReady(true);
  }, []);

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

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobile();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen, closeMobile]);

  const isSignedIn = hasServerSession;
  const roleNav = buildRoleNavConfig({ mode: navMode, accountMenu, dashboardHref });
  const cartItemCount = quickCart?.itemCount ?? 0;
  const hasActiveCart =
    cartItemCount > 0 || Boolean(quickCart?.hasActiveGroupOrder);
  const showCart = shouldShowHeaderCart({ navMode, hasActiveCart });
  const prominentCart = cartItemCount > 0 || Boolean(quickCart?.hasActiveGroupOrder);
  const showBusinessCta = roleNav.showBusinessCta;

  const businessCtaHref = homePodOwnerMailtoHref();
  const mobileAccountRowClass = cn(mobileNavRowBase, mobileNavRowIdle, "w-full justify-start border-0 bg-transparent shadow-none");

  const mobileMenuOverlay =
    mobileOpen && menuPortalReady && typeof document !== "undefined"
      ? createPortal(
          <>
            <button
              type="button"
              className={cn(
                "fixed inset-0 z-[80] bg-oo-charcoal/45 backdrop-blur-sm motion-safe:transition-opacity lg:hidden",
                MOBILE_MENU_TOP
              )}
              aria-label="Close menu"
              onClick={closeMobile}
            />
            <div
              id="site-mobile-menu"
              className={cn(
                "fixed inset-x-0 z-[90] overflow-y-auto pb-4 lg:hidden",
                MOBILE_MENU_TOP,
                MOBILE_MENU_MAX_H
              )}
              role="dialog"
              aria-modal="true"
              aria-label="Mobile navigation"
            >
              <div className="oo-shell pt-2">
                <div className="animate-oo-mobile-menu-in rounded-b-2xl border border-oo-light-stone bg-oo-warm-white p-4 shadow-xl">
                  <nav className="flex flex-col gap-1" aria-label="Primary">
                    {roleNav.headerLinks.map((link) => (
                      <NavLink
                        key={link.href}
                        href={link.href}
                        label={link.label}
                        pathname={pathname}
                        onNavigate={closeMobile}
                        mobile
                      />
                    ))}
                  </nav>

                  {roleNav.headerLinks.length > 0 && (
                    <div className="my-3 border-t border-oo-light-stone" aria-hidden />
                  )}

                  {isSignedIn ? (
                    <MobileAccountNavSection
                      accountMenu={accountMenu}
                      hasServerSession={hasServerSession}
                      navMode={navMode}
                      dashboardHref={dashboardHref}
                      onNavigate={closeMobile}
                    />
                  ) : (
                    <HeaderSignInLink className={mobileAccountRowClass} title="Sign in" />
                  )}

                  {showCart && (
                    <>
                      <div className="my-3 border-t border-oo-light-stone" aria-hidden />
                      <CartControl
                        cartHref={cartHref}
                        activeOrderHref={activeOrderHref}
                        cartPulse={cartPulse}
                        prominent={prominentCart}
                        mobile
                        onNavigate={closeMobile}
                      />
                    </>
                  )}

                  {showBusinessCta && (
                    <a
                      href={businessCtaHref}
                      className={cn(
                        buttonClassName({ variant: "primary", size: "md" }),
                        headerFocusVisible,
                        "mt-4 w-full shadow-[0_0_16px_rgba(249,115,22,0.28)]"
                      )}
                      onClick={closeMobile}
                    >
                      {HOME_PRIMARY_CTA_LABEL}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <>
      <nav className="flex min-w-0 flex-1 items-center justify-end gap-3 lg:justify-between" aria-label="Site">
        {roleNav.headerLinks.length > 0 ? (
          <div className={cn(navPill, "hidden lg:inline-flex")}>
            {roleNav.headerLinks.map((link) => (
              <NavLink key={link.href} href={link.href} label={link.label} pathname={pathname} />
            ))}
          </div>
        ) : (
          <div className="hidden flex-1 lg:block" aria-hidden />
        )}

        <div className="hidden items-center gap-2 lg:flex">
          {showBusinessCta && (
            <a href={businessCtaHref} className={headerPrimaryCta}>
              {HOME_PRIMARY_CTA_LABEL}
            </a>
          )}
          {isSignedIn ? (
            <AccountHeaderDropdown
              accountMenu={accountMenu}
              hasServerSession={hasServerSession}
              navMode={navMode}
              dashboardHref={dashboardHref}
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
          className={mobileOpen ? mobileMenuToggleOpen : mobileMenuToggleIdle}
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

      {mobileMenuOverlay}
    </>
  );
}

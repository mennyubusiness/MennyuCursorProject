"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

type NavItem = { href: string; label: string };

const ORDERS: NavItem[] = [
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/exceptions", label: "Issues & refunds" },
  { href: "/admin/payout-transfers", label: "Vendor transfers" },
];

const MARKETPLACE: NavItem[] = [
  { href: "/admin/pods", label: "Pods" },
  { href: "/admin/vendors", label: "Vendors" },
];

const OPERATIONS: NavItem[] = [
  { href: "/admin/incidents", label: "Incidents" },
  { href: "/admin/notifications", label: "Notifications" },
  { href: "/admin/webhooks", label: "Webhooks" },
  { href: "/admin/menu-imports", label: "Menu imports" },
  { href: "/admin/deliverect-webhook-incidents", label: "POS sync" },
  { href: "/admin/deliverect-connections", label: "Deliverect connections" },
];

const SETTINGS: NavItem[] = [{ href: "/admin/pricing", label: "Pricing" }];

/** Route prefixes that activate each dropdown (includes nested admin pages). */
const ORDERS_PREFIXES = ["/admin/orders", "/admin/exceptions", "/admin/payout-transfers"];
const MARKETPLACE_PREFIXES = ["/admin/pods", "/admin/vendors"];
const OPERATIONS_PREFIXES = [
  "/admin/incidents",
  "/admin/notifications",
  "/admin/webhooks",
  "/admin/menu-imports",
  "/admin/deliverect-webhook-incidents",
  "/admin/deliverect-connections",
  "/admin/deliverect-channel-registrations",
];
const SETTINGS_PREFIXES = ["/admin/pricing"];

function pathMatches(href: string, pathname: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function pathMatchesAny(prefixes: string[], pathname: string) {
  return prefixes.some((p) => pathMatches(p, pathname));
}

function groupActive(items: NavItem[], pathname: string) {
  return items.some((i) => pathMatches(i.href, pathname));
}

function NavTopLink({
  href,
  label,
  pathname,
  active,
}: {
  href: string;
  label: string;
  pathname: string;
  active?: boolean;
}) {
  const isActive = active ?? pathMatches(href, pathname);
  return (
    <Link
      href={href}
      className={cn("oo-dash-titlebar-link shrink-0", isActive && "is-active")}
    >
      {label}
    </Link>
  );
}

function NavDropdown({
  id,
  label,
  items,
  pathname,
  openId,
  setOpenId,
  activePrefixes,
}: {
  id: string;
  label: string;
  items: NavItem[];
  pathname: string;
  openId: string | null;
  setOpenId: (v: string | null) => void;
  activePrefixes?: string[];
}) {
  const open = openId === id;
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpenId(null), [setOpenId]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, close]);

  const active =
    (activePrefixes ? pathMatchesAny(activePrefixes, pathname) : false) ||
    groupActive(items, pathname);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        className={cn("oo-dash-titlebar-link", active && "is-group-active")}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpenId(open ? null : id)}
        onMouseEnter={() => setOpenId(id)}
      >
        {label}
        <span className="oo-dash-titlebar-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div
          className="oo-dash-titlebar-menu"
          role="menu"
          onMouseLeave={() => setOpenId(null)}
        >
          {items.map((item) => {
            const itemActive = pathMatches(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                className={cn("oo-dash-titlebar-menu-link", itemActive && "is-active")}
                onClick={close}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AdminTopNav() {
  const pathname = usePathname() ?? "";
  const [openId, setOpenId] = useState<string | null>(null);

  const healthActive = pathMatches("/admin/health", pathname);
  const usersActive = pathMatches("/admin/users", pathname);
  const analyticsActive = pathMatches("/admin/analytics", pathname);

  return (
    <nav
      className="-mx-1 flex max-w-full flex-wrap items-center gap-x-0.5 gap-y-2 overflow-x-auto px-1"
      aria-label="Admin"
    >
      <NavTopLink href="/admin" label="Dashboard" pathname={pathname} />

      <NavDropdown
        id="orders"
        label="Orders"
        items={ORDERS}
        pathname={pathname}
        openId={openId}
        setOpenId={setOpenId}
        activePrefixes={ORDERS_PREFIXES}
      />
      <NavDropdown
        id="marketplace"
        label="Marketplace"
        items={MARKETPLACE}
        pathname={pathname}
        openId={openId}
        setOpenId={setOpenId}
        activePrefixes={MARKETPLACE_PREFIXES}
      />
      <NavDropdown
        id="operations"
        label="Operations"
        items={OPERATIONS}
        pathname={pathname}
        openId={openId}
        setOpenId={setOpenId}
        activePrefixes={OPERATIONS_PREFIXES}
      />

      <NavTopLink
        href="/admin/users"
        label="Users"
        pathname={pathname}
        active={usersActive}
      />
      <NavTopLink
        href="/admin/health"
        label="Health"
        pathname={pathname}
        active={healthActive}
      />
      <NavTopLink
        href="/admin/analytics"
        label="Analytics"
        pathname={pathname}
        active={analyticsActive}
      />

      <NavDropdown
        id="settings"
        label="Settings"
        items={SETTINGS}
        pathname={pathname}
        openId={openId}
        setOpenId={setOpenId}
        activePrefixes={SETTINGS_PREFIXES}
      />
    </nav>
  );
}

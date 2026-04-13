"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type NavItem = { href: string; label: string };

const ORDERS: NavItem[] = [
  { href: "/admin/orders", label: "All orders" },
  { href: "/admin/exceptions", label: "Issues" },
];

const MARKETPLACE: NavItem[] = [
  { href: "/admin/vendors", label: "Vendors" },
  { href: "/admin/pods", label: "Pods" },
];

const OPERATIONS: NavItem[] = [
  { href: "/admin/menu-imports", label: "Menu sync" },
  { href: "/admin/payout-transfers", label: "Payouts" },
  { href: "/admin/deliverect-webhook-incidents", label: "POS sync" },
  { href: "/admin/deliverect-channel-registrations", label: "Channel registration" },
];

const SETTINGS: NavItem[] = [
  { href: "/admin/pricing", label: "Pricing" },
  { href: "/admin/analytics", label: "Analytics" },
];

function pathMatches(href: string, pathname: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function groupActive(items: NavItem[], pathname: string) {
  return items.some((i) => pathMatches(i.href, pathname));
}

function NavDropdown({
  id,
  label,
  items,
  pathname,
  openId,
  setOpenId,
}: {
  id: string;
  label: string;
  items: NavItem[];
  pathname: string;
  openId: string | null;
  setOpenId: (v: string | null) => void;
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

  const active = groupActive(items, pathname);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={`flex items-center gap-0.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
          active ? "font-semibold text-stone-900" : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
        }`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpenId(open ? null : id)}
        onMouseEnter={() => setOpenId(id)}
      >
        {label}
        <span className="text-stone-400" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border border-stone-200 bg-white py-1 shadow-lg"
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
                className={`block px-3 py-2 text-sm ${
                  itemActive ? "bg-stone-100 font-medium text-stone-900" : "text-stone-700 hover:bg-stone-50"
                }`}
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

  const dashboardActive = pathname === "/admin";

  return (
    <nav className="flex flex-wrap items-center gap-x-1 gap-y-2" aria-label="Admin">
      <Link
        href="/admin"
        className={`rounded-md px-2 py-1.5 text-sm ${
          dashboardActive ? "font-semibold text-stone-900" : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
        }`}
      >
        Dashboard
      </Link>

      <NavDropdown
        id="orders"
        label="Orders"
        items={ORDERS}
        pathname={pathname}
        openId={openId}
        setOpenId={setOpenId}
      />
      <NavDropdown
        id="marketplace"
        label="Marketplace"
        items={MARKETPLACE}
        pathname={pathname}
        openId={openId}
        setOpenId={setOpenId}
      />
      <NavDropdown
        id="operations"
        label="Operations"
        items={OPERATIONS}
        pathname={pathname}
        openId={openId}
        setOpenId={setOpenId}
      />
      <NavDropdown
        id="settings"
        label="Settings"
        items={SETTINGS}
        pathname={pathname}
        openId={openId}
        setOpenId={setOpenId}
      />
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "dashboard", label: "Dashboard" },
  { href: "orders", label: "Orders" },
  { href: "menu", label: "Menu" },
  { href: "hours", label: "Hours" },
  { href: "payouts", label: "Payouts" },
  { href: "settings", label: "Settings" },
] as const;

function navLinkIsActive(pathname: string, base: string, href: string): boolean {
  const path = `${base}/${href}`;
  if (href === "dashboard") {
    return pathname === path || pathname === base;
  }
  if (href === "orders") {
    return pathname === path || pathname.startsWith(`${path}/`);
  }
  if (href === "menu") {
    return pathname === path || pathname.startsWith(`${path}/`);
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function VendorAreaNav({ vendorId, wide = false }: { vendorId: string; wide?: boolean }) {
  const pathname = usePathname();
  const base = `/vendor/${vendorId}`;
  const widthClass = wide
    ? "mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2"
    : "mx-auto flex max-w-2xl flex-wrap items-center gap-2 px-4 py-2";

  return (
    <nav className="oo-dash-nav" aria-label="Vendor area">
      <div className={widthClass}>
        <div className="flex flex-wrap gap-1">
          {NAV_LINKS.map(({ href, label }) => {
            const path = `${base}/${href}`;
            const isActive = navLinkIsActive(pathname, base, href);
            return (
              <Link
                key={href}
                href={path}
                className={isActive ? "oo-dash-nav-link-active" : "oo-dash-nav-link"}
              >
                {label}
              </Link>
            );
          })}
        </div>
        <div className="ml-auto hidden gap-1 sm:flex">
          <Link href={`${base}/kitchen`} className="oo-dash-nav-link">
            Kitchen
          </Link>
          <Link href={`${base}/issues`} className="oo-dash-nav-link">
            Issues
          </Link>
          {!pathname.includes("/setup") ? (
            <Link href={`${base}/setup`} className="oo-dash-nav-link">
              Setup
            </Link>
          ) : null}
        </div>
      </div>
    </nav>
  );
}

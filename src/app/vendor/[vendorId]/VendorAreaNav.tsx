"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { VendorOrderRoutingMode } from "@prisma/client";
import {
  vendorMenuManagementNavLabel,
  vendorMenuManagementPath,
} from "@/lib/vendor-menu-management";

const BASE_NAV_LINKS = [
  { href: "dashboard", label: "Dashboard" },
  { href: "orders", label: "Orders" },
  { href: "hours", label: "Hours" },
  { href: "payouts", label: "Payouts" },
  { href: "setup", label: "Setup" },
  { href: "settings", label: "Vendor Profile" },
] as const;

function navLinkIsActive(pathname: string, base: string, href: string): boolean {
  const path = `${base}/${href}`;
  if (href === "dashboard") {
    return pathname === path || pathname === base;
  }
  if (href === "orders") {
    return pathname === path || pathname.startsWith(`${path}/`);
  }
  if (href === "menu-builder" || href === "menu/imports") {
    return (
      pathname === `${base}/menu-builder` ||
      pathname.startsWith(`${base}/menu-builder/`) ||
      pathname === `${base}/menu/imports` ||
      pathname.startsWith(`${base}/menu/imports/`) ||
      pathname === `${base}/menu` ||
      pathname.startsWith(`${base}/menu/`) ||
      pathname.startsWith(`${base}/menu-imports`)
    );
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function VendorAreaNav({
  vendorId,
  orderRoutingMode,
  wide = false,
}: {
  vendorId: string;
  orderRoutingMode: VendorOrderRoutingMode;
  wide?: boolean;
}) {
  const pathname = usePathname();
  const base = `/vendor/${vendorId}`;
  const menuPath = vendorMenuManagementPath(vendorId, orderRoutingMode);
  const menuHref = menuPath.replace(`${base}/`, "");
  const menuLabel = vendorMenuManagementNavLabel(orderRoutingMode);
  const navLinks = [
    BASE_NAV_LINKS[0],
    BASE_NAV_LINKS[1],
    { href: menuHref, label: menuLabel },
    ...BASE_NAV_LINKS.slice(2),
  ];
  const widthClass = wide
    ? "mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2"
    : "mx-auto flex max-w-2xl flex-wrap items-center gap-2 px-4 py-2";

  return (
    <nav className="oo-dash-nav" aria-label="Vendor area">
      <div className={widthClass}>
        <div className="flex flex-wrap gap-1">
          {navLinks.map(({ href, label }) => {
            const path = href.includes("/") ? `${base}/${href}` : `${base}/${href}`;
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
        </div>
      </div>
    </nav>
  );
}

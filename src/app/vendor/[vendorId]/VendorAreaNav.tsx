"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "orders", label: "Orders" },
  { href: "kitchen", label: "Kitchen" },
  { href: "issues", label: "Issues" },
  { href: "menu", label: "Menu" },
  { href: "analytics", label: "Analytics" },
  { href: "settings", label: "Settings" },
] as const;

function navLinkIsActive(pathname: string, base: string, href: string): boolean {
  const path = `${base}/${href}`;
  if (href === "orders") {
    return pathname === path || pathname === base;
  }
  if (href === "kitchen") {
    return pathname === path || pathname.startsWith(`${path}/`);
  }
  if (href === "menu") {
    return pathname === path;
  }
  return pathname === path;
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
      </div>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "orders", label: "Orders" },
  { href: "menu", label: "Menu" },
  { href: "analytics", label: "Analytics" },
  { href: "settings", label: "Settings" },
] as const;

function navLinkIsActive(pathname: string, base: string, href: string): boolean {
  const path = `${base}/${href}`;
  if (href === "orders") {
    return pathname === path || pathname === base;
  }
  if (href === "menu") {
    return pathname === path;
  }
  return pathname === path;
}

export function VendorAreaNav({ vendorId }: { vendorId: string }) {
  const pathname = usePathname();
  const base = `/vendor/${vendorId}`;

  return (
    <nav className="border-b border-stone-200 bg-white" aria-label="Vendor area">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-2 px-4 py-2">
        <div className="flex flex-wrap gap-1">
        {NAV_LINKS.map(({ href, label }) => {
          const path = `${base}/${href}`;
          const isActive = navLinkIsActive(pathname, base, href);
          return (
            <Link
              key={href}
              href={path}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-stone-100 text-stone-900"
                  : "text-stone-600 hover:bg-stone-50 hover:text-stone-800"
              }`}
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

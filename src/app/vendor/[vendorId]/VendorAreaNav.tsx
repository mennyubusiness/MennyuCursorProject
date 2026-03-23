"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const NAV_LINKS = [
  { href: "orders", label: "Orders" },
  { href: "menu-imports", label: "Menu imports" },
  { href: "analytics", label: "Analytics" },
  { href: "settings", label: "Settings" },
] as const;

export function VendorAreaNav({ vendorId }: { vendorId: string }) {
  const pathname = usePathname();
  const base = `/vendor/${vendorId}`;
  const { status } = useSession();

  return (
    <nav className="border-b border-stone-200 bg-white" aria-label="Vendor area">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-2 px-4 py-2">
        <div className="flex flex-wrap gap-1">
        {NAV_LINKS.map(({ href, label }) => {
          const path = `${base}/${href}`;
          const isActive = pathname === path || (href === "orders" && pathname === base);
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
        {status === "authenticated" && (
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/" })}
            className="text-sm text-stone-600 hover:text-stone-900 hover:underline"
          >
            Sign out
          </button>
        )}
      </div>
    </nav>
  );
}

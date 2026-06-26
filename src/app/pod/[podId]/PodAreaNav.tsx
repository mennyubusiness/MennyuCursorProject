"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "dashboard", label: "Dashboard" },
  { href: "vendors", label: "Vendors" },
  { href: "analytics", label: "Analytics" },
  { href: "promote", label: "Promote" },
  { href: "payouts", label: "Payouts" },
  { href: "setup", label: "Readiness" },
  { href: "settings", label: "Pod Profile" },
] as const;

function navLinkIsActive(pathname: string, base: string, href: string): boolean {
  const path = `${base}/${href}`;
  if (href === "dashboard") {
    return pathname === path || pathname === base;
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function PodAreaNav({
  podId,
  wide = false,
  showPayouts = false,
}: {
  podId: string;
  wide?: boolean;
  showPayouts?: boolean;
}) {
  const pathname = usePathname();
  const base = `/pod/${podId}`;
  const widthClass = wide
    ? "mx-auto flex max-w-7xl flex-wrap gap-1 px-4 py-2"
    : "mx-auto flex max-w-2xl flex-wrap gap-1 px-4 py-2";

  const links = NAV_LINKS.filter((link) => link.href !== "payouts" || showPayouts);

  return (
    <nav className="oo-dash-nav" aria-label="Pod area">
      <div className={widthClass}>
        {links.map(({ href, label }) => {
          const path = `${base}/${href}`;
          const isActive = navLinkIsActive(pathname ?? "", base, href);
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
    </nav>
  );
}

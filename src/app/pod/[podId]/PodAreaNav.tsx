"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";

const NAV_LINKS = [
  { href: "dashboard", label: "Overview" },
  { href: "settings", label: "Settings" },
] as const;

export function PodAreaNav() {
  const pathname = usePathname();
  const params = useParams();
  const podId = params?.podId as string | undefined;
  if (!podId) return null;

  const base = `/pod/${podId}`;

  return (
    <nav className="oo-dash-nav" aria-label="Pod area">
      <div className="mx-auto flex max-w-2xl gap-1 px-4 py-2">
        {NAV_LINKS.map(({ href, label }) => {
          const path = `${base}/${href}`;
          const isActive = pathname === path;
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

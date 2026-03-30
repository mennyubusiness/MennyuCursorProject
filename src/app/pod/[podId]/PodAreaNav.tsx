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
    <nav className="border-b border-stone-200 bg-white" aria-label="Pod area">
      <div className="mx-auto flex max-w-2xl gap-1 px-4 py-2">
        {NAV_LINKS.map(({ href, label }) => {
          const path = `${base}/${href}`;
          const isActive = pathname === path;
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
    </nav>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getFavoritePods,
  getFavoriteVendors,
  getRecentViews,
  MENNYU_LOCAL_RETENTION_EVENT,
  type RecentViewEntry,
} from "@/lib/customer-local-storage";

function hrefFor(entry: RecentViewEntry): string {
  return entry.kind === "pod" ? `/pod/${entry.id}` : `/pod/${entry.podId}/vendor/${entry.id}`;
}

function labelFor(entry: RecentViewEntry): string {
  return entry.kind === "pod" ? entry.name : `${entry.name}`;
}

function ChipThumb({ label }: { label: string }) {
  const letter = label.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-stone-200 to-stone-300 text-xs font-bold text-stone-700 ring-2 ring-white shadow-sm"
      aria-hidden
    >
      {letter}
    </span>
  );
}

type CustomerRetentionStripProps = {
  /** Screen-reader / section heading */
  heading?: string;
  className?: string;
};

export function CustomerRetentionStrip({
  heading = "Pick up where you left off",
  className = "",
}: CustomerRetentionStripProps) {
  const [recent, setRecent] = useState<RecentViewEntry[]>([]);
  const [favPods, setFavPods] = useState(() => getFavoritePods());
  const [favVendors, setFavVendors] = useState(() => getFavoriteVendors());

  const refresh = useCallback(() => {
    setRecent(getRecentViews());
    setFavPods(getFavoritePods());
    setFavVendors(getFavoriteVendors());
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(MENNYU_LOCAL_RETENTION_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(MENNYU_LOCAL_RETENTION_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  const favoriteLinks = useMemo(() => {
    const out: { href: string; label: string; sub: string }[] = [];
    for (const p of favPods.slice(0, 4)) {
      out.push({ href: `/pod/${p.id}`, label: p.name, sub: "Pod" });
    }
    for (const v of favVendors.slice(0, 4)) {
      out.push({ href: `/pod/${v.podId}/vendor/${v.id}`, label: v.name, sub: "Vendor" });
    }
    return out.slice(0, 6);
  }, [favPods, favVendors]);

  const recentLinks = useMemo(() => {
    return recent.map((e) => ({
      href: hrefFor(e),
      label: labelFor(e),
      sub: e.kind === "pod" ? "Pod" : "Vendor",
    }));
  }, [recent]);

  if (favoriteLinks.length === 0 && recentLinks.length === 0) return null;

  return (
    <section
      className={`rounded-2xl border border-stone-200/90 bg-white p-4 shadow-sm sm:p-5 ${className}`}
      aria-labelledby="retention-strip-heading"
    >
      <h2 id="retention-strip-heading" className="text-base font-semibold text-stone-900 sm:text-lg">
        {heading}
      </h2>

      <div className="mt-4 space-y-4">
        {recentLinks.length > 0 && (
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
              Recently viewed
            </h3>
            <ul className="mt-2 flex gap-2 overflow-x-auto pb-1 pt-0.5 [scrollbar-width:thin]">
              {recentLinks.map((l) => (
                <li key={`${l.sub}-${l.href}`} className="shrink-0">
                  <Link
                    href={l.href}
                    className="flex max-w-[16rem] items-center gap-2 rounded-full border border-stone-200/90 bg-stone-50/90 py-1 pl-1 pr-3 text-sm font-medium text-stone-800 shadow-sm transition hover:border-mennyu-primary/50 hover:bg-white hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mennyu-primary active:scale-[0.99]"
                  >
                    <ChipThumb label={l.label} />
                    <span className="min-w-0 flex-1 truncate">{l.label}</span>
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                      {l.sub}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {favoriteLinks.length > 0 && (
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Saved</h3>
            <ul className="mt-2 flex gap-2 overflow-x-auto pb-1 pt-0.5 [scrollbar-width:thin]">
              {favoriteLinks.map((l) => (
                <li key={`fav-${l.href}`} className="shrink-0">
                  <Link
                    href={l.href}
                    className="flex max-w-[16rem] items-center gap-2 rounded-full border border-rose-200/90 bg-rose-50/80 py-1 pl-1 pr-3 text-sm font-medium text-rose-950 shadow-sm transition hover:border-rose-300 hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mennyu-primary active:scale-[0.99]"
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-700 ring-2 ring-white shadow-sm"
                      aria-hidden
                    >
                      ♥
                    </span>
                    <span className="min-w-0 flex-1 truncate">{l.label}</span>
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-rose-800/90">
                      {l.sub}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

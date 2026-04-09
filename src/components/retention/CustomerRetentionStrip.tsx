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
      className={`rounded-2xl border border-stone-200/90 bg-white p-5 shadow-sm sm:p-6 ${className}`}
      aria-labelledby="retention-strip-heading"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 id="retention-strip-heading" className="text-lg font-semibold text-stone-900">
          {heading}
        </h2>
        <p className="text-xs text-stone-500">Saved on this device only</p>
      </div>
      <div className="mt-4 space-y-5">
        {recentLinks.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Recently viewed</h3>
            <ul className="mt-2 flex flex-wrap gap-2">
              {recentLinks.map((l) => (
                <li key={`${l.sub}-${l.href}`}>
                  <Link
                    href={l.href}
                    className="inline-flex max-w-[14rem] items-center gap-2 rounded-full border border-stone-200 bg-stone-50/90 px-3 py-1.5 text-sm font-medium text-stone-800 transition hover:border-mennyu-primary/40 hover:bg-mennyu-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mennyu-primary active:scale-[0.99]"
                  >
                    <span className="truncate">{l.label}</span>
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
            <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Saved</h3>
            <ul className="mt-2 flex flex-wrap gap-2">
              {favoriteLinks.map((l) => (
                <li key={`fav-${l.href}`}>
                  <Link
                    href={l.href}
                    className="inline-flex max-w-[14rem] items-center gap-2 rounded-full border border-rose-100 bg-rose-50/60 px-3 py-1.5 text-sm font-medium text-rose-950 transition hover:border-rose-200 hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mennyu-primary active:scale-[0.99]"
                  >
                    <span aria-hidden className="text-rose-600">
                      ♥
                    </span>
                    <span className="truncate">{l.label}</span>
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-rose-700/80">
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

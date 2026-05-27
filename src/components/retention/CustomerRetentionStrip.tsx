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
import { cn } from "@/lib/cn";

function hrefFor(entry: RecentViewEntry): string {
  return entry.kind === "pod" ? `/pod/${entry.id}` : `/pod/${entry.podId}/vendor/${entry.id}`;
}

function labelFor(entry: RecentViewEntry): string {
  return entry.kind === "pod" ? entry.name : `${entry.name}`;
}

function ChipThumb({ label, favorite }: { label: string; favorite?: boolean }) {
  if (favorite) {
    return (
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/15 text-xs font-bold text-brand ring-1 ring-oo-light-stone"
        aria-hidden
      >
        ♥
      </span>
    );
  }
  const letter = label.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-oo-cream text-xs font-bold text-oo-charcoal ring-1 ring-oo-light-stone"
      aria-hidden
    >
      {letter}
    </span>
  );
}

const chipLinkClass =
  "group flex min-w-[10rem] max-w-[16rem] items-center gap-2.5 rounded-xl border border-oo-light-stone bg-oo-warm-white py-2 pl-2 pr-3 text-sm font-medium text-oo-charcoal shadow-sm transition hover:-translate-y-0.5 hover:border-stone-400 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:hover:translate-y-0";

type CustomerRetentionStripProps = {
  heading?: string;
  helperText?: string;
  className?: string;
  /** When true, render the panel shell even if there is no local data yet. */
  showEmptyPlaceholder?: boolean;
  /** Inside a parent card (e.g. homepage module); no outer border/shadow. */
  embedded?: boolean;
};

export function CustomerRetentionStrip({
  heading = "Pick up where you left off",
  helperText,
  className = "",
  showEmptyPlaceholder = false,
  embedded = false,
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

  const hasContent = favoriteLinks.length > 0 || recentLinks.length > 0;
  if (!hasContent && !showEmptyPlaceholder) return null;

  return (
    <section
      className={cn(
        embedded
          ? "min-w-0"
          : "rounded-xl border border-oo-light-stone bg-oo-warm-white p-4 shadow-sm sm:p-5",
        className
      )}
      aria-labelledby="retention-strip-heading"
    >
      <h2
        id="retention-strip-heading"
        className={cn(
          "font-bold tracking-tight text-oo-charcoal",
          embedded ? "text-xl sm:text-2xl" : "text-lg"
        )}
      >
        {heading}
      </h2>
      {helperText ? <p className="mt-1 text-sm text-oo-stone-gray">{helperText}</p> : null}

      {!hasContent ? (
        <p className="mt-4 text-sm leading-relaxed text-oo-stone-gray">
          Your recent pods and vendors will show up here as you browse.{" "}
          <Link href="/explore" className="font-semibold text-brand hover:text-[#EA580C] hover:underline">
            Explore food pods
          </Link>
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {recentLinks.length > 0 && (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-oo-stone-gray">
                Recently viewed
              </h3>
              <ul className="mt-2 flex gap-2 overflow-x-auto pb-1 pt-0.5 [scrollbar-width:thin]">
                {recentLinks.map((l) => (
                  <li key={`${l.sub}-${l.href}`} className="shrink-0">
                    <Link href={l.href} className={chipLinkClass}>
                      <ChipThumb label={l.label} />
                      <span className="min-w-0 flex-1 truncate">{l.label}</span>
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-oo-stone-gray">
                        {l.sub}
                      </span>
                      <span
                        className="shrink-0 text-oo-stone-gray transition group-hover:translate-x-0.5 group-hover:text-brand"
                        aria-hidden
                      >
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {favoriteLinks.length > 0 && (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-oo-stone-gray">Saved</h3>
              <ul className="mt-2 flex gap-2 overflow-x-auto pb-1 pt-0.5 [scrollbar-width:thin]">
                {favoriteLinks.map((l) => (
                  <li key={`fav-${l.href}`} className="shrink-0">
                    <Link href={l.href} className={chipLinkClass}>
                      <ChipThumb label={l.label} favorite />
                      <span className="min-w-0 flex-1 truncate">{l.label}</span>
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-brand">
                        {l.sub}
                      </span>
                      <span
                        className="shrink-0 text-oo-stone-gray transition group-hover:translate-x-0.5 group-hover:text-brand"
                        aria-hidden
                      >
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

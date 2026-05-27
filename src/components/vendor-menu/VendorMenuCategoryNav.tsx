"use client";

import { useCallback, useEffect, useState } from "react";
import { customerMenuCategoryDomId } from "@/lib/vendor-menu-category-id";
import { cn } from "@/lib/cn";

export type VendorMenuNavSection = {
  id: string;
  name: string;
};

type VendorMenuCategoryNavProps = {
  sections: VendorMenuNavSection[];
  vendorAccentColor?: string | null;
  /** Extra anchor targets (e.g. spotlight band). */
  extraAnchors?: { id: string; label: string }[];
};

const STICKY_TOP = "top-[calc(4.25rem+1px)]";

export function VendorMenuCategoryNav({
  sections,
  vendorAccentColor,
  extraAnchors = [],
}: VendorMenuCategoryNavProps) {
  const anchors = [
    ...extraAnchors.map((a) => ({ id: a.id, label: a.label })),
    ...sections.map((s) => ({
      id: customerMenuCategoryDomId(s.id),
      label: s.name,
    })),
  ];

  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    if (anchors.length === 0) return;
    setActiveId(anchors[0]!.id);
    const ids = anchors.map((a) => a.id);
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el != null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.15, 0.5] }
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [sections, extraAnchors]);

  const linkClass = useCallback(
    (id: string, compact: boolean) =>
      cn(
        "shrink-0 font-semibold transition-colors",
        compact
          ? "rounded-full border px-3 py-1.5 text-xs"
          : "block w-full rounded-lg px-3 py-2 text-left text-sm",
        activeId === id
          ? compact
            ? "border-brand bg-brand text-white"
            : "bg-brand-muted text-oo-charcoal"
          : compact
            ? "border-oo-light-stone bg-oo-warm-white text-oo-charcoal hover:border-oo-stone-gray/50"
            : "text-oo-stone-gray hover:bg-oo-cream hover:text-oo-charcoal"
      ),
    [activeId]
  );

  if (anchors.length === 0) return null;

  return (
    <>
      <nav
        className={cn(
          "hidden lg:block lg:w-44 lg:shrink-0 xl:w-48",
          "sticky",
          STICKY_TOP,
          "self-start max-h-[calc(100vh-5.5rem)] overflow-y-auto pb-8"
        )}
        aria-label="Menu categories"
      >
        <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-oo-stone-gray">
          Menu
        </p>
        <ul className="space-y-0.5">
          {anchors.map(({ id, label }) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className={linkClass(id, false)}
                style={
                  activeId === id && vendorAccentColor
                    ? { borderLeftWidth: 3, borderLeftColor: vendorAccentColor, paddingLeft: 9 }
                    : undefined
                }
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div
        className={cn(
          "sticky z-30 -mx-4 border-b border-oo-light-stone bg-oo-warm-white/95 px-4 py-2 backdrop-blur-md supports-[backdrop-filter]:bg-oo-warm-white/85 lg:hidden",
          "top-16 sm:top-[4.25rem]"
        )}
      >
        <div
          className="flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="navigation"
          aria-label="Menu categories"
        >
          {anchors.map(({ id, label }) => (
            <a key={id} href={`#${id}`} className={linkClass(id, true)}>
              {label}
            </a>
          ))}
        </div>
      </div>
    </>
  );
}

"use client";

import { cn } from "@/lib/cn";

export type PodPageNavItem = {
  id: string;
  label: string;
};

type PodPageStickyNavProps = {
  items: PodPageNavItem[];
};

export function PodPageStickyNav({ items }: PodPageStickyNavProps) {
  if (items.length === 0) return null;

  return (
    <nav
      className="sticky top-16 z-40 border-b border-oo-light-stone bg-oo-warm-white/95 shadow-sm backdrop-blur-md sm:top-[4.25rem]"
      aria-label="Pod sections"
    >
      <div className="oo-shell flex gap-1 overflow-x-auto py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map(({ id, label }) => (
          <a
            key={id}
            href={`#${id}`}
            className={cn(
              "shrink-0 rounded-full border border-transparent px-3.5 py-1.5 text-sm font-semibold text-oo-stone-gray transition-colors",
              "hover:border-oo-light-stone hover:bg-oo-cream hover:text-oo-charcoal",
              "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            )}
          >
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}

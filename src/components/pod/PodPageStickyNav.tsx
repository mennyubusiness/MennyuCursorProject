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
      className="sticky top-16 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/80 sm:top-[4.25rem]"
      aria-label="Pod sections"
    >
      <div className="oo-shell flex gap-0.5 overflow-x-auto py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map(({ id, label }) => (
          <a
            key={id}
            href={`#${id}`}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold text-zinc-600 transition-colors",
              "hover:bg-zinc-100 hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
            )}
          >
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}

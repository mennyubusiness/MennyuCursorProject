"use client";

import type { ReactNode } from "react";
import { FavoritePodButton } from "@/components/retention/FavoritePodButton";
import { cn } from "@/lib/cn";

export type PodPageNavItem = {
  id: string;
  label: string;
};

type PodPageStickyNavProps = {
  items: PodPageNavItem[];
  podId: string;
  podName: string;
  trailingActions?: ReactNode;
};

const savePodButtonClass =
  "shrink-0 !h-9 !border-oo-light-stone !bg-oo-warm-white !px-3 !text-oo-charcoal shadow-sm hover:!border-oo-stone-gray hover:!bg-oo-cream focus-visible:!outline-brand";

export function PodPageStickyNav({ items, podId, podName, trailingActions }: PodPageStickyNavProps) {
  return (
    <nav
      className="sticky top-16 z-30 border-b border-oo-light-stone bg-oo-warm-white/95 shadow-sm backdrop-blur-md sm:top-[4.25rem]"
      aria-label="Pod sections"
    >
      <div className="oo-shell flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:gap-3">
        {items.length > 0 && (
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
        )}
        <div
          className={cn(
            "flex flex-wrap items-center justify-end gap-2",
            items.length === 0 && "w-full"
          )}
        >
          {trailingActions}
          <FavoritePodButton
            podId={podId}
            podName={podName}
            labeled
            saveLabel="Save pod"
            savedLabel="Saved"
            className={cn(savePodButtonClass, items.length === 0 && !trailingActions && "ml-auto")}
          />
        </div>
      </div>
    </nav>
  );
}

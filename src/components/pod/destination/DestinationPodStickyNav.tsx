"use client";

import { FavoritePodButton } from "@/components/retention/FavoritePodButton";
import type { PodPageNavItem } from "@/components/pod/PodPageStickyNav";
import { cn } from "@/lib/cn";

type DestinationPodStickyNavProps = {
  items: PodPageNavItem[];
  podId: string;
  podName: string;
};

const navLinkClass = cn(
  "inline-flex h-10 shrink-0 items-center rounded-full border border-transparent px-3 text-sm font-semibold leading-none text-oo-stone-gray transition-colors",
  "hover:border-oo-light-stone hover:bg-oo-cream hover:text-oo-charcoal",
  "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
);

const savePodButtonClass = cn(
  "shrink-0 !h-10 !min-h-10 !max-h-10 !px-3.5 !py-0 !border-oo-light-stone !bg-oo-warm-white !text-xs !font-semibold !text-oo-charcoal",
  "shadow-sm hover:!border-oo-stone-gray hover:!bg-oo-cream focus-visible:!outline-brand"
);

/** Compact single-row nav for Destination pods — nav links left, Save pod right. */
export function DestinationPodStickyNav({ items, podId, podName }: DestinationPodStickyNavProps) {
  return (
    <nav
      className="sticky top-16 z-30 border-b border-oo-light-stone bg-oo-warm-white/95 shadow-sm backdrop-blur-md sm:top-[4.25rem]"
      aria-label="Pod sections"
    >
      <div className="oo-shell flex items-center justify-between gap-3 py-3">
        {items.length > 0 ? (
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto sm:gap-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {items.map(({ id, label }) => (
              <a key={id} href={`#${id}`} className={navLinkClass}>
                {label}
              </a>
            ))}
          </div>
        ) : (
          <div className="min-w-0 flex-1" aria-hidden />
        )}

        <div className="flex shrink-0 items-center self-center">
          <FavoritePodButton
            podId={podId}
            podName={podName}
            labeled
            saveLabel="Save pod"
            savedLabel="Saved"
            className={savePodButtonClass}
          />
        </div>
      </div>
    </nav>
  );
}

"use client";

import type { PodCardPod } from "./PodCard";
import { PodCard } from "./PodCard";

type ExplorePopularPodsProps = {
  pods: PodCardPod[];
};

/** First pods from the same list as the main grid — no extra fetch. */
export function ExplorePopularPods({ pods }: ExplorePopularPodsProps) {
  const slice = pods.slice(0, 8);
  if (slice.length === 0) return null;

  return (
    <section aria-labelledby="explore-popular-heading" className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <h2 id="explore-popular-heading" className="text-lg font-semibold text-stone-900 sm:text-xl">
          Popular right now
        </h2>
        <p className="hidden text-sm text-stone-500 sm:block">Swipe to explore</p>
      </div>
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 pt-1 [scrollbar-width:thin] sm:mx-0 sm:px-0">
        {slice.map((pod) => (
          <PodCard key={pod.id} pod={pod} variant="compact" />
        ))}
      </div>
    </section>
  );
}

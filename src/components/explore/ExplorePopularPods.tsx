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
    <section aria-labelledby="explore-popular-heading">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="explore-popular-heading" className="text-2xl font-bold tracking-tight text-black sm:text-3xl">
            Popular right now
          </h2>
          <p className="mt-1 text-sm text-zinc-600 sm:text-base">Curated picks across the network</p>
        </div>
        <p className="hidden text-xs font-semibold uppercase tracking-wider text-zinc-500 sm:block">
          Scroll →
        </p>
      </div>
      <div className="-mx-4 mt-8 flex gap-5 overflow-x-auto px-4 pb-3 pt-1 [scrollbar-width:thin] sm:-mx-0 sm:px-0 lg:gap-6">
        {slice.map((pod) => (
          <PodCard key={pod.id} pod={pod} variant="compact" />
        ))}
      </div>
    </section>
  );
}

"use client";

import type { PodCardPod } from "./PodCard";
import { PodCard } from "./PodCard";

type ExplorePopularPodsProps = {
  pods: PodCardPod[];
  onViewAll?: () => void;
};

/** First pods from the same list as the main grid — no extra fetch. */
export function ExplorePopularPods({ pods, onViewAll }: ExplorePopularPodsProps) {
  const slice = pods.slice(0, 8);
  if (slice.length === 0) return null;

  return (
    <section aria-labelledby="explore-popular-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="explore-popular-heading" className="oo-section-title text-2xl sm:text-3xl">
            Popular right now
          </h2>
          <p className="mt-1 text-sm text-oo-stone-gray sm:text-base">
            Curated picks across the network
          </p>
        </div>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="self-start text-sm font-semibold text-brand hover:underline sm:self-auto"
          >
            View all pods →
          </button>
        )}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:gap-5">
        {slice.map((pod) => (
          <PodCard key={pod.id} pod={pod} variant="compact" />
        ))}
      </div>
    </section>
  );
}

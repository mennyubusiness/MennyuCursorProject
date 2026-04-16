"use client";

import { useMemo, useState } from "react";
import type { PodCardPod } from "@/components/explore/PodCard";
import { PodCard } from "@/components/explore/PodCard";
import {
  ExploreVendorResultRow,
  type ExploreVendorSearchHit,
} from "@/components/explore/ExploreVendorResultRow";

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase();
}

export function ExplorePodList({ pods }: { pods: PodCardPod[] }) {
  const [query, setQuery] = useState("");

  const q = normalizeQuery(query);
  const hasQuery = q.length > 0;

  const matchingPods = useMemo(() => {
    if (!hasQuery) return pods;
    return pods
      .filter((pod) => pod.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [pods, hasQuery, q]);

  const matchingVendors = useMemo((): ExploreVendorSearchHit[] => {
    if (!hasQuery) return [];
    const rows: ExploreVendorSearchHit[] = [];
    for (const pod of pods) {
      for (const pv of pod.vendors) {
        const v = pv.vendor;
        if (v.name.toLowerCase().includes(q)) {
          rows.push({
            vendorId: v.id,
            vendorName: v.name,
            description: v.description,
            podId: pod.id,
            podName: pod.name,
          });
        }
      }
    }
    rows.sort((a, b) =>
      a.vendorName.localeCompare(b.vendorName) || a.podName.localeCompare(b.podName)
    );
    return rows;
  }, [pods, hasQuery, q]);

  const showVendorSection = hasQuery && matchingVendors.length > 0;
  const showEmptySearch =
    hasQuery && matchingPods.length === 0 && matchingVendors.length === 0;

  return (
    <div>
      <div className="mb-6">
        <label htmlFor="pod-search" className="sr-only">
          Search pods or vendors
        </label>
        <div className="relative max-w-lg">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </span>
          <input
            id="pod-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pods or vendors..."
            className="w-full rounded-xl border border-stone-300/90 bg-white py-3 pl-11 pr-4 text-stone-900 shadow-md placeholder:text-stone-400 transition focus:border-mennyu-primary focus:outline-none focus:ring-2 focus:ring-mennyu-primary/40"
            aria-label="Search pods or vendors"
          />
        </div>
      </div>

      {!hasQuery && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {pods.map((pod) => (
            <PodCard key={pod.id} pod={pod} variant="full" />
          ))}
        </div>
      )}

      {hasQuery && showEmptySearch && (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white/90 p-10 text-center shadow-inner">
          <p className="font-medium text-stone-800">No results found</p>
          <p className="mt-2 text-sm text-stone-600">
            Try different words, or clear the search to browse all pods.
          </p>
        </div>
      )}

      {hasQuery && !showEmptySearch && (
        <div className="space-y-10">
          {matchingPods.length > 0 && (
            <section aria-labelledby="explore-results-pods">
              <h3
                id="explore-results-pods"
                className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500"
              >
                Pods
              </h3>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {matchingPods.map((pod) => (
                  <PodCard key={pod.id} pod={pod} variant="full" />
                ))}
              </div>
            </section>
          )}

          {showVendorSection && (
            <section aria-labelledby="explore-results-vendors">
              <h3
                id="explore-results-vendors"
                className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500"
              >
                Vendors
              </h3>
              <ul className="space-y-3">
                {matchingVendors.map((hit) => (
                  <li key={`${hit.podId}-${hit.vendorId}`}>
                    <ExploreVendorResultRow hit={hit} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {!hasQuery && pods.length === 0 && (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white/90 p-10 text-center shadow-inner">
          <p className="font-medium text-stone-800">No pods yet. Run the seed script to add sample data.</p>
        </div>
      )}
    </div>
  );
}

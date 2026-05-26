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

function ExploreEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="oo-empty-state">
      <p className="text-lg font-bold text-black">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600">{description}</p>
    </div>
  );
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
      <div className="mb-10">
        <label htmlFor="pod-search" className="oo-label">
          Search pods or vendors
        </label>
        <div className="relative mt-2 max-w-2xl">
          <span
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
            aria-hidden
          >
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
            placeholder="Search by pod or vendor name…"
            className="oo-input !mt-0 py-3.5 pl-12 pr-4 text-base shadow-sm"
            aria-label="Search pods or vendors"
          />
        </div>
      </div>

      {!hasQuery && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-8">
          {pods.map((pod) => (
            <PodCard key={pod.id} pod={pod} variant="full" />
          ))}
        </div>
      )}

      {hasQuery && showEmptySearch && (
        <ExploreEmptyState
          title="No results found"
          description="Try different words, or clear the search to browse all pods on the network."
        />
      )}

      {hasQuery && !showEmptySearch && (
        <div className="space-y-14">
          {matchingPods.length > 0 && (
            <section aria-labelledby="explore-results-pods">
              <h3
                id="explore-results-pods"
                className="mb-6 text-xs font-bold uppercase tracking-[0.15em] text-zinc-500"
              >
                Pods · {matchingPods.length}
              </h3>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-8">
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
                className="mb-6 text-xs font-bold uppercase tracking-[0.15em] text-zinc-500"
              >
                Vendors · {matchingVendors.length}
              </h3>
              <ul className="grid gap-4 lg:grid-cols-2">
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
        <ExploreEmptyState
          title="No pods on the network yet"
          description="Run the seed script to add sample pods, or list your pod to go live."
        />
      )}
    </div>
  );
}

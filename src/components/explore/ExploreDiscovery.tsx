"use client";

import { useMemo, useState } from "react";

import type { PodCardPod } from "@/components/explore/PodCard";
import { PodCard } from "@/components/explore/PodCard";
import {
  ExploreVendorResultRow,
} from "@/components/explore/ExploreVendorResultRow";
import { CustomerRetentionStrip } from "@/components/retention/CustomerRetentionStrip";
import {
  filterMatchingPodsByName,
  filterExploreVendors,
  getAvailableCuisineChips,
  hasActiveExploreFilters,
} from "@/lib/explore-discovery";
import { cn } from "@/lib/cn";

type ExploreDiscoveryProps = {
  pods: PodCardPod[];
};

function ExploreEmptyState({
  title,
  description,
  suggestions,
  onSuggestionClick,
}: {
  title: string;
  description: string;
  suggestions?: { id: string; label: string }[];
  onSuggestionClick?: (id: string) => void;
}) {
  return (
    <div className="oo-empty-state border-oo-light-stone bg-oo-warm-white">
      <p className="text-lg font-bold text-oo-charcoal">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-oo-stone-gray">{description}</p>
      {suggestions && suggestions.length > 0 && onSuggestionClick && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {suggestions.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => onSuggestionClick(chip.id)}
              className="rounded-full border border-oo-light-stone bg-oo-cream px-3 py-1.5 text-xs font-semibold text-oo-charcoal transition hover:border-brand hover:text-brand"
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ExploreDiscovery({ pods }: ExploreDiscoveryProps) {
  const [query, setQuery] = useState("");
  const [cuisineId, setCuisineId] = useState("all");

  const cuisineChips = useMemo(() => getAvailableCuisineChips(pods), [pods]);
  const matchingPods = useMemo(() => filterMatchingPodsByName(pods, query), [pods, query]);
  const filteredVendors = useMemo(
    () => filterExploreVendors(pods, query, cuisineId),
    [pods, query, cuisineId]
  );

  const activeFilters = hasActiveExploreFilters(query, cuisineId);
  const noResults = filteredVendors.length === 0;

  const suggestionChips = useMemo(
    () =>
      cuisineChips.filter((chip) => chip.id !== "all" && chip.id !== cuisineId).slice(0, 4),
    [cuisineChips, cuisineId]
  );

  return (
    <div className="space-y-12 sm:space-y-14">
      <div className="space-y-5">
        <div>
          <label htmlFor="explore-search" className="sr-only">
            Search pods, vendors, cuisines, or cravings
          </label>
          <div className="relative">
            <span
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-oo-stone-gray"
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
              id="explore-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pods, vendors, cuisines, or cravings..."
              className="oo-input !mt-0 w-full rounded-2xl border-oo-light-stone bg-oo-warm-white py-4 pl-12 pr-4 text-base text-oo-charcoal shadow-sm placeholder:text-oo-stone-gray/80"
              aria-label="Search pods, vendors, cuisines, or cravings"
            />
          </div>
        </div>

        {cuisineChips.length > 1 && (
          <div
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:thin] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
            role="group"
            aria-label="Filter by cuisine"
          >
            {cuisineChips.map((chip) => {
              const active = cuisineId === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setCuisineId(chip.id)}
                  aria-pressed={active}
                  className={cn(
                    "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition",
                    active
                      ? "border-brand bg-brand text-white shadow-sm"
                      : "border-oo-light-stone bg-oo-warm-white text-oo-charcoal hover:border-oo-stone-gray/40 hover:bg-oo-cream"
                  )}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {matchingPods.length > 0 && (
        <section className="space-y-4" aria-labelledby="matching-pod-heading">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 id="matching-pod-heading" className="oo-section-title">
                Matching pod
              </h2>
              <p className="mt-2 text-sm text-oo-stone-gray sm:text-base">
                Direct pod name match{matchingPods.length === 1 ? "" : "es"} for your search.
              </p>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-6">
            {matchingPods.map((pod) => (
              <PodCard key={pod.id} pod={pod} variant="full" />
            ))}
          </div>
        </section>
      )}

      <section id="explore-all-results" className="scroll-mt-28 space-y-6" aria-live="polite">
        <div className="flex flex-col gap-2 border-b border-oo-light-stone pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="oo-section-title">
              {query.trim() ? `Vendors matching “${query.trim()}”` : "All vendors"}
            </h2>
            <p className="mt-2 text-sm text-oo-stone-gray sm:text-base">
              {query.trim()
                ? `${filteredVendors.length} vendor${filteredVendors.length === 1 ? "" : "s"} matched`
                : `${filteredVendors.length} vendor${filteredVendors.length === 1 ? "" : "s"} across the network`}
            </p>
          </div>
          {activeFilters && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setCuisineId("all");
              }}
              className="self-start text-sm font-semibold text-brand hover:underline sm:self-auto"
            >
              Clear filters
            </button>
          )}
        </div>

        {!noResults && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:gap-5">
            {filteredVendors.map((hit) => (
              <li key={`${hit.podId}-${hit.vendorId}`}>
                <ExploreVendorResultRow hit={hit} />
              </li>
            ))}
          </ul>
        )}

        {noResults && pods.length > 0 && (
          <ExploreEmptyState
            title="No matches yet"
            description="Try searching for a pod, vendor, or cuisine."
            suggestions={suggestionChips.map((c) => ({ id: c.id, label: c.label }))}
            onSuggestionClick={(id) => {
              setCuisineId(id);
            }}
          />
        )}

        {pods.length === 0 && (
          <ExploreEmptyState
            title="No pods on the network yet"
            description="Run the seed script to add sample pods, or list your pod to go live."
          />
        )}
      </section>

      <CustomerRetentionStrip
        className="border-oo-light-stone bg-oo-warm-white p-6 shadow-sm sm:p-8"
        heading="Continue browsing"
      />
    </div>
  );
}

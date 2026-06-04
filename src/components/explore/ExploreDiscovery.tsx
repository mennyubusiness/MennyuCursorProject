"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { PodCardPod } from "@/components/explore/PodCard";
import { PodCard } from "@/components/explore/PodCard";
import { ExploreVendorResultRow } from "@/components/explore/ExploreVendorResultRow";
import { CustomerRetentionStrip } from "@/components/retention/CustomerRetentionStrip";
import {
  filterMatchingPodsByName,
  filterExploreVendors,
  getAvailableCuisineChips,
  getExplorePodsToDisplay,
  getExploreSearchEmptyMessage,
  getExploreVendorSectionTitle,
  getPodVendorCounts,
  hasActiveExploreFilters,
  shouldHidePodSectionForSearchOnly,
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedPodId = searchParams.get("pod")?.trim() || null;

  const [query, setQuery] = useState("");
  const [cuisineId, setCuisineId] = useState("all");

  const selectedPod = useMemo(
    () => (selectedPodId ? pods.find((p) => p.id === selectedPodId) ?? null : null),
    [pods, selectedPodId]
  );

  const cuisineChips = useMemo(() => getAvailableCuisineChips(pods), [pods]);
  const matchingPodsByName = useMemo(() => filterMatchingPodsByName(pods, query), [pods, query]);
  const podsToDisplay = useMemo(
    () => getExplorePodsToDisplay(pods, query, cuisineId, selectedPodId),
    [pods, query, cuisineId, selectedPodId]
  );
  const podsForMainGrid = useMemo(() => {
    if (matchingPodsByName.length > 0 && query.trim() && !selectedPodId) {
      const highlighted = new Set(matchingPodsByName.map((p) => p.id));
      return podsToDisplay.filter((p) => !highlighted.has(p.id));
    }
    return podsToDisplay;
  }, [podsToDisplay, matchingPodsByName, query, selectedPodId]);
  const hidePodSection = useMemo(
    () => shouldHidePodSectionForSearchOnly(pods, query, cuisineId) && !selectedPodId,
    [pods, query, cuisineId, selectedPodId]
  );

  const filteredVendors = useMemo(
    () => filterExploreVendors(pods, query, cuisineId, selectedPodId),
    [pods, query, cuisineId, selectedPodId]
  );

  const vendorSection = useMemo(
    () =>
      getExploreVendorSectionTitle({
        query,
        cuisineId,
        selectedPodId,
        selectedPodName: selectedPod?.name ?? null,
      }),
    [query, cuisineId, selectedPodId, selectedPod?.name]
  );

  const activeFilters = hasActiveExploreFilters(query, cuisineId, selectedPodId);
  const noVendorResults = filteredVendors.length === 0;
  const selectedPodCounts = selectedPod ? getPodVendorCounts(selectedPod) : null;

  const suggestionChips = useMemo(
    () =>
      cuisineChips.filter((chip) => chip.id !== "all" && chip.id !== cuisineId).slice(0, 4),
    [cuisineChips, cuisineId]
  );

  const setPodFilter = useCallback(
    (podId: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (podId) {
        params.set("pod", podId);
      } else {
        params.delete("pod");
      }
      const qs = params.toString();
      router.push(qs ? `/explore?${qs}` : "/explore", { scroll: false });
      requestAnimationFrame(() => {
        document.getElementById("explore-vendors")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
    [router, searchParams]
  );

  const clearAllFilters = useCallback(() => {
    setQuery("");
    setCuisineId("all");
    setPodFilter(null);
  }, [setPodFilter]);

  return (
    <div className="space-y-10 sm:space-y-12">
      <div className="sticky top-0 z-20 -mx-4 border-b border-oo-light-stone/80 bg-oo-cream/95 px-4 pb-4 pt-1 backdrop-blur-sm sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-0">
        <div className="space-y-4">
          <div>
            <label htmlFor="explore-search" className="sr-only">
              Search vendors, cuisines, dishes, or pods
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
                placeholder="Search vendors, cuisines, dishes, or pods"
                className="oo-input !mt-0 w-full rounded-2xl border-oo-light-stone bg-oo-warm-white py-4 pl-12 pr-4 text-base text-oo-charcoal shadow-sm placeholder:text-oo-stone-gray/80"
                aria-label="Search vendors, cuisines, dishes, or pods"
              />
            </div>
          </div>
        </div>
      </div>

      {pods.length === 0 ? (
        <ExploreEmptyState
          title="No pods are available yet"
          description="Check back soon."
        />
      ) : (
        <>
          {!hidePodSection && (
            <section className="space-y-4" aria-labelledby="choose-pod-heading">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 id="choose-pod-heading" className="oo-section-title">
                    {selectedPod ? selectedPod.name : "Choose a pod"}
                  </h2>
                  <p className="mt-2 text-sm text-oo-stone-gray sm:text-base">
                    {selectedPod
                      ? "Vendors below are scoped to this pod. Clear the filter to browse everywhere."
                      : "Pick a location, then order from one or more vendors."}
                  </p>
                </div>
                {selectedPodId && (
                  <button
                    type="button"
                    onClick={() => setPodFilter(null)}
                    className="self-start text-sm font-semibold text-brand hover:underline"
                  >
                    Clear pod filter
                  </button>
                )}
              </div>

              {matchingPodsByName.length > 0 && query.trim() && !selectedPodId && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-oo-charcoal">Matching pods</p>
                  <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3 xl:grid-cols-4">
                    {matchingPodsByName.map((pod) => (
                      <div key={pod.id} className="w-[min(85vw,320px)] shrink-0 sm:w-auto">
                        <PodCard
                          pod={pod}
                          variant="compact"
                          onSelectPod={setPodFilter}
                          isSelected={selectedPodId === pod.id}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div
                className={cn(
                  "-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3 xl:grid-cols-4",
                  matchingPodsByName.length > 0 && query.trim() && !selectedPodId && "sm:mt-2"
                )}
              >
                {podsForMainGrid.map((pod) => (
                  <div key={pod.id} className="w-[min(85vw,320px)] shrink-0 sm:w-auto">
                    <PodCard
                      pod={pod}
                      variant="compact"
                      onSelectPod={setPodFilter}
                      isSelected={selectedPodId === pod.id}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {cuisineChips.length > 1 && (
            <section aria-labelledby="cuisine-filter-heading">
              <h2 id="cuisine-filter-heading" className="sr-only">
                Browse by craving
              </h2>
              <p className="mb-3 text-sm font-semibold text-oo-charcoal">Browse by craving</p>
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
            </section>
          )}
        </>
      )}

      <section
        id="explore-vendors"
        className="scroll-mt-28 space-y-6"
        aria-live="polite"
      >
        <div className="flex flex-col gap-2 border-b border-oo-light-stone pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="oo-section-title">{vendorSection.title}</h2>
            <p className="mt-2 text-sm text-oo-stone-gray sm:text-base">{vendorSection.subtitle}</p>
            {!noVendorResults && (
              <p className="mt-1 text-xs font-medium text-oo-stone-gray">
                {filteredVendors.length} vendor{filteredVendors.length === 1 ? "" : "s"}
              </p>
            )}
          </div>
          {activeFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="self-start text-sm font-semibold text-brand hover:underline sm:self-auto"
            >
              Clear filters
            </button>
          )}
        </div>

        {!noVendorResults && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:gap-5">
            {filteredVendors.map((hit) => (
              <li key={`${hit.podId}-${hit.vendorId}`}>
                <ExploreVendorResultRow hit={hit} showPodContext={!selectedPodId} />
              </li>
            ))}
          </ul>
        )}

        {noVendorResults && pods.length > 0 && (
          <ExploreEmptyState
            title={getExploreSearchEmptyMessage(query, cuisineId, selectedPodId).title}
            description={getExploreSearchEmptyMessage(query, cuisineId, selectedPodId).description}
            suggestions={suggestionChips.map((c) => ({ id: c.id, label: c.label }))}
            onSuggestionClick={(id) => setCuisineId(id)}
          />
        )}

        {selectedPod &&
          selectedPodCounts &&
          selectedPodCounts.open === 0 &&
          !noVendorResults &&
          filteredVendors.every((v) => v.availabilityStatus !== "open") && (
            <p className="text-sm text-oo-stone-gray" role="status">
              No vendors are open at this pod right now.
            </p>
          )}
      </section>

      <CustomerRetentionStrip
        className="border-oo-light-stone bg-oo-warm-white p-6 shadow-sm sm:p-8"
        heading="Continue browsing"
      />
    </div>
  );
}

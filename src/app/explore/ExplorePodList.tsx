"use client";

import { useState, useMemo } from "react";
import type { PodCardPod } from "@/components/explore/PodCard";
import { PodCard } from "@/components/explore/PodCard";

export function ExplorePodList({ pods }: { pods: PodCardPod[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pods;
    return pods.filter((pod) => {
      if (pod.name.toLowerCase().includes(q)) return true;
      return pod.vendors.some((v) => v.vendor.name.toLowerCase().includes(q));
    });
  }, [pods, query]);

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
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white/90 p-10 text-center shadow-inner">
          <p className="font-medium text-stone-800">
            {pods.length === 0
              ? "No pods yet. Run the seed script to add sample data."
              : "No pods match your search."}
          </p>
          {pods.length > 0 && (
            <p className="mt-2 text-sm text-stone-600">Try a shorter name or clear the search box.</p>
          )}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((pod) => (
            <PodCard key={pod.id} pod={pod} variant="full" />
          ))}
        </div>
      )}
    </div>
  );
}

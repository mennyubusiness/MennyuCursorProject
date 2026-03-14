"use client";

import Link from "next/link";
import { useState, useMemo } from "react";

type PodForList = {
  id: string;
  name: string;
  description: string | null;
  vendors: { vendor: unknown }[];
};

export function ExplorePodList({ pods }: { pods: PodForList[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pods;
    return pods.filter((pod) => pod.name.toLowerCase().includes(q));
  }, [pods, query]);

  return (
    <div>
      <div className="mb-4">
        <label htmlFor="pod-search" className="sr-only">
          Search pods
        </label>
        <input
          id="pod-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search pods by name…"
          className="w-full max-w-md rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 placeholder-stone-400 focus:border-mennyu-primary focus:outline-none focus:ring-1 focus:ring-mennyu-primary"
          aria-label="Search pods"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="rounded-xl border border-stone-200 bg-mennyu-muted p-6 text-center text-stone-600">
          {pods.length === 0
            ? "No pods yet. Run the seed script to add sample data."
            : "No pods match your search."}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((pod) => (
            <Link
              key={pod.id}
              href={`/pod/${pod.id}`}
              className="block rounded-xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-mennyu-primary/30 hover:shadow-md"
            >
              <h2 className="font-semibold text-stone-900">{pod.name}</h2>
              {pod.description && (
                <p className="mt-1 text-sm text-stone-600">{pod.description}</p>
              )}
              <p className="mt-2 text-sm text-mennyu-primary">
                {pod.vendors.length} vendor{pod.vendors.length !== 1 ? "s" : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

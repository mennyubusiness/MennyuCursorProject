"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { PodLogo } from "@/components/images/PodLogo";

type PodForList = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  accentColor: string | null;
  vendors: { vendor: { name: string } }[];
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
      <div className="mb-6">
        <label htmlFor="pod-search" className="sr-only">
          Search pods
        </label>
        <input
          id="pod-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search pods by name…"
          className="w-full max-w-md rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-stone-900 shadow-sm placeholder:text-stone-400 transition focus:border-mennyu-primary focus:outline-none focus:ring-2 focus:ring-mennyu-primary/35"
          aria-label="Search pods"
        />
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-mennyu-muted/50 p-10 text-center">
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
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((pod) => {
            const vendorCount = pod.vendors.length;
            const featuredVendorName = pod.vendors[0]?.vendor.name;
            return (
              <Link
                key={pod.id}
                href={`/pod/${pod.id}`}
                className="group relative flex gap-4 overflow-hidden rounded-2xl border border-stone-200/90 bg-white p-5 shadow-sm ring-1 ring-black/[0.03] transition duration-200 hover:-translate-y-0.5 hover:border-mennyu-primary/35 hover:shadow-lg hover:ring-mennyu-primary/15 active:scale-[0.99] sm:p-6"
                style={
                  pod.accentColor
                    ? {
                        borderLeftWidth: 4,
                        borderLeftStyle: "solid",
                        borderLeftColor: pod.accentColor,
                      }
                    : undefined
                }
              >
                <PodLogo
                  imageUrl={pod.imageUrl}
                  podName={pod.name}
                  className="h-16 w-16 shrink-0 shadow-sm transition duration-200 group-hover:shadow-md sm:h-[4.5rem] sm:w-[4.5rem]"
                  sizes="72px"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-lg font-semibold leading-snug text-stone-900 transition group-hover:text-stone-950">
                      {pod.name}
                    </h2>
                  </div>
                  {pod.description && (
                    <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-stone-600">
                      {pod.description}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span
                      className="inline-flex items-center rounded-full bg-stone-100 px-2.5 py-0.5 font-medium text-stone-800"
                      style={
                        pod.accentColor
                          ? { backgroundColor: `${pod.accentColor}18`, color: pod.accentColor }
                          : undefined
                      }
                    >
                      {vendorCount} vendor{vendorCount !== 1 ? "s" : ""}
                    </span>
                    <span className="text-xs font-medium uppercase tracking-wide text-stone-400">
                      Pickup hub
                    </span>
                  </div>
                  {featuredVendorName && (
                    <p className="mt-2 line-clamp-2 text-xs text-stone-500">
                      <span className="font-medium text-stone-600">Featuring</span> · {featuredVendorName}
                      {vendorCount > 1 ? ` + ${vendorCount - 1} more` : ""}
                    </p>
                  )}
                  <p className="mt-4 text-sm font-semibold text-mennyu-primary underline-offset-4 transition group-hover:underline">
                    View pod →
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

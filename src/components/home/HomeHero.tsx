"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PodLogo } from "@/components/images/PodLogo";

export type HomeHeroFeaturedPod = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  vendorCount: number;
};

const ROTATE_MS = 7000;

/** Static fallback when no pods in DB — structure matches real data for future wiring. */
const PLACEHOLDER_FEATURES: HomeHeroFeaturedPod[] = [
  {
    id: "sample-1",
    name: "Your local food hub",
    description: "Browse pods, mix vendors, and check out once.",
    imageUrl: null,
    vendorCount: 0,
  },
];

export function HomeHero({ featuredPods }: { featuredPods: HomeHeroFeaturedPod[] }) {
  const slides = useMemo(
    () => (featuredPods.length > 0 ? featuredPods : PLACEHOLDER_FEATURES),
    [featuredPods]
  );
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, ROTATE_MS);
    return () => window.clearInterval(t);
  }, [slides.length]);

  const active = slides[index]!;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-stone-200/80 bg-gradient-to-br from-white via-mennyu-muted/40 to-amber-50/50 shadow-[0_1px_0_rgba(0,0,0,0.04),0_12px_40px_-12px_rgba(0,0,0,0.12)]">
      <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-mennyu-primary/15 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-amber-200/20 blur-3xl" aria-hidden />

      <div className="relative grid gap-8 p-8 sm:grid-cols-[1fr,minmax(0,280px)] sm:items-center sm:p-10 lg:gap-12">
        <div className="space-y-4 sm:space-y-5">
          <h1 className="text-balance text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl">
            Multi-vendor ordering
          </h1>
          <p className="text-2xl font-semibold leading-snug text-stone-800 sm:text-[1.65rem]">
            Order everywhere. Pay once.
          </p>
          <p className="max-w-xl text-base leading-relaxed text-stone-600 sm:text-lg">
            Skip the lines and pick up in one trip.
          </p>
          <div className="pt-1">
            <Link
              href="/explore"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-mennyu-primary px-7 py-3 text-base font-semibold text-black shadow-sm transition duration-200 hover:bg-mennyu-secondary hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mennyu-primary active:scale-[0.98]"
            >
              Explore food pods
            </Link>
          </div>
        </div>

        <div className="relative flex min-h-[200px] flex-col justify-between rounded-xl border border-stone-200/90 bg-white/90 p-5 shadow-sm backdrop-blur-sm transition-opacity duration-500 sm:min-h-[220px]">
          <div
            key={active.id}
            className="animate-mennyu-fade-in motion-reduce:animate-none"
          >
            <div className="flex gap-4">
              <PodLogo
                imageUrl={active.imageUrl}
                podName={active.name}
                className="h-16 w-16 shrink-0 rounded-xl shadow-sm"
                sizes="64px"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Featured pod
                </p>
                <p className="truncate text-lg font-semibold text-stone-900">{active.name}</p>
                {active.vendorCount > 0 && (
                  <p className="mt-1 text-sm font-medium text-mennyu-primary">
                    {active.vendorCount} vendor{active.vendorCount !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
            </div>
            {active.description && (
              <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-stone-600">{active.description}</p>
            )}
          </div>
          {featuredPods.length > 0 && (
            <div className="mt-6 flex items-center justify-between gap-3 border-t border-stone-100 pt-4">
              <Link
                href={`/pod/${active.id}`}
                className="text-sm font-semibold text-mennyu-primary underline-offset-4 transition hover:underline"
              >
                View pod →
              </Link>
              {slides.length > 1 && (
                <div className="flex gap-1.5" role="tablist" aria-label="Featured pods">
                  {slides.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      role="tab"
                      aria-selected={i === index}
                      onClick={() => setIndex(i)}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        i === index ? "w-6 bg-mennyu-primary" : "w-2 bg-stone-300 hover:bg-stone-400"
                      }`}
                      aria-label={`Show featured pod ${i + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

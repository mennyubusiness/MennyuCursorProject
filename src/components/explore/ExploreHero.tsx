"use client";

import { useEffect, useMemo, useState } from "react";

type ExploreHeroProps = {
  /** Pod names to rotate in the subline (first few pods). */
  featuredPodNames: string[];
};

export function ExploreHero({ featuredPodNames }: ExploreHeroProps) {
  const [idx, setIdx] = useState(0);
  const names = useMemo(() => featuredPodNames.filter(Boolean), [featuredPodNames]);
  const rotating = names.length > 0;

  useEffect(() => {
    if (!rotating || names.length < 2) return;
    const t = window.setInterval(() => {
      setIdx((i) => (i + 1) % names.length);
    }, 4500);
    return () => window.clearInterval(t);
  }, [rotating, names.length]);

  const highlight = rotating ? names[idx] : null;

  return (
    <section
      className="relative isolate min-h-[240px] overflow-hidden rounded-2xl border border-stone-300/60 shadow-lg"
      aria-labelledby="explore-hero-heading"
    >
      <div
        className="animate-mennyu-hero-gradient absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(125deg, #1c1917 0%, #292524 25%, #422006 50%, #1c1917 75%, #0c0a09 100%)",
          backgroundSize: "200% 200%",
        }}
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(255,189,89,0.22),transparent_55%)]"
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/25 to-transparent" aria-hidden />

      <div className="relative flex min-h-[240px] flex-col justify-end px-6 py-8 sm:px-10 sm:py-10">
        <h1
          id="explore-hero-heading"
          className="max-w-2xl text-3xl font-bold tracking-tight text-white drop-shadow-sm sm:text-4xl"
        >
          Order Everywhere. Pay Once.
        </h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-stone-200 sm:text-lg">
          Mix vendors, skip lines, pick up in one trip.
        </p>
        {highlight && (
          <p
            className="mt-4 text-sm font-medium text-mennyu-primary transition-opacity duration-500"
            key={highlight}
          >
            <span className="text-stone-400">Featured: </span>
            {highlight}
          </p>
        )}
      </div>
    </section>
  );
}

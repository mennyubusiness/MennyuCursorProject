"use client";

import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/layout/page-shell";

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
      className="relative isolate w-full overflow-hidden border-b border-oo-charcoal/30 bg-oo-charcoal text-oo-warm-white"
      aria-labelledby="explore-hero-heading"
    >
      <div
        className="animate-mennyu-hero-gradient pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "linear-gradient(125deg, #1f1f1c 0%, #2a2a26 30%, #353530 55%, #1f1f1c 100%)",
          backgroundSize: "200% 200%",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_80%_-10%,rgba(249,115,22,0.16),transparent_50%)]"
        aria-hidden
      />

      <PageShell className="relative flex min-h-[min(52vh,28rem)] flex-col justify-end py-14 sm:min-h-[min(58vh,32rem)] sm:py-16 lg:py-20">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-oo-cream/50">
          <span className="oo-live-dot" aria-hidden />
          Discover food pods
        </p>
        <h1
          id="explore-hero-heading"
          className="oo-display mt-5 max-w-4xl text-4xl text-oo-warm-white sm:text-5xl md:text-6xl lg:text-7xl"
        >
          Order everywhere.
          <span className="block text-oo-cream/55">Pay once.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-oo-cream/70 sm:text-xl">
          Browse curated pods, mix vendors, and pick up in one trip — built for urban marketplaces at
          scale.
        </p>
        {highlight && (
          <p
            className="mt-6 text-sm font-medium text-oo-cream/80 transition-opacity duration-500 sm:text-base"
            key={highlight}
          >
            <span className="text-oo-cream/45">Featured now · </span>
            <span className="text-oo-warm-white">{highlight}</span>
          </p>
        )}
      </PageShell>
    </section>
  );
}

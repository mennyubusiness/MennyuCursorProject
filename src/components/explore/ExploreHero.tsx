"use client";

import { useEffect, useMemo, useState } from "react";
import { HomeHeroBrand } from "@/components/home/HomeHeroBrand";
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

      <PageShell className="relative flex min-h-[min(44vh,24rem)] flex-col justify-end py-12 sm:min-h-[min(48vh,28rem)] sm:py-14 lg:py-16">
        <HomeHeroBrand className="scale-[0.85] origin-left sm:scale-100" />
        <p className="mt-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-oo-cream/50">
          <span className="oo-live-dot" aria-hidden />
          Secondary path · Find a pod
        </p>
        <h1
          id="explore-hero-heading"
          className="mt-5 max-w-3xl text-3xl font-black leading-tight tracking-tight text-oo-warm-white sm:text-4xl md:text-5xl"
        >
          Explore participating pods
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-oo-cream/70 sm:text-lg">
          Most guests scan the QR code on-site and start ordering right away. Use this page when you
          need to find a pod without a code.
        </p>
        {highlight && (
          <p
            className="mt-5 text-sm font-medium text-oo-cream/80 transition-opacity duration-500 sm:text-base"
            key={highlight}
          >
            <span className="text-oo-cream/45">Active pod · </span>
            <span className="text-oo-warm-white">{highlight}</span>
          </p>
        )}
      </PageShell>
    </section>
  );
}

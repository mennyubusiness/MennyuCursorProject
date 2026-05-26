"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PodLogo } from "@/components/images/PodLogo";
import { ButtonLink } from "@/components/ui/button";
import { PageShell } from "@/components/layout/page-shell";
import { cn } from "@/lib/cn";

export type HomeHeroFeaturedPod = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  vendorCount: number;
};

const ROTATE_MS = 7000;

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
    <section className="relative isolate w-full overflow-hidden border-b border-zinc-800 bg-black text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(105deg, transparent 0%, rgba(212,16,16,0.08) 45%, transparent 70%), radial-gradient(ellipse 80% 50% at 100% 0%, rgba(212,16,16,0.15), transparent 50%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,rgba(0,0,0,0.4)_100%)]"
        aria-hidden
      />

      <PageShell className="relative grid min-h-[min(88vh,52rem)] gap-12 py-16 sm:py-20 lg:grid-cols-[1.15fr_minmax(0,22rem)] lg:items-end lg:gap-16 lg:py-24 xl:grid-cols-[1.2fr_minmax(0,26rem)]">
        <div className="flex flex-col justify-end animate-oo-fade-up motion-reduce:animate-none">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            <span className="oo-live-dot" aria-hidden />
            Live ordering network
          </p>
          <h1 className="oo-display mt-6 text-5xl leading-[0.95] text-white sm:text-6xl md:text-7xl lg:text-8xl">
            Order everywhere.
            <span className="mt-1 block text-zinc-500">Pay once.</span>
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-zinc-400 sm:text-xl">
            Multi-vendor food pods on one cart, one checkout, one pickup — built for speed at scale.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <ButtonLink href="/explore" size="lg" className="w-full sm:w-auto">
              Explore food pods
            </ButtonLink>
            <ButtonLink
              href="/register"
              variant="secondary"
              size="lg"
              className="w-full border-zinc-600 text-white hover:border-white hover:bg-white hover:text-black sm:w-auto"
            >
              Run a pod
            </ButtonLink>
          </div>
        </div>

        <div
          className={cn(
            "flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-2xl backdrop-blur-sm",
            "animate-oo-fade-up motion-reduce:animate-none [animation-delay:120ms]"
          )}
        >
          <div key={active.id} className="animate-mennyu-fade-in motion-reduce:animate-none">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
              Featured pod
            </p>
            <div className="mt-4 flex gap-4">
              <PodLogo
                imageUrl={active.imageUrl}
                podName={active.name}
                className="h-14 w-14 shrink-0 rounded-lg ring-1 ring-zinc-700"
                sizes="56px"
              />
              <div className="min-w-0">
                <p className="truncate text-xl font-bold tracking-tight text-white">{active.name}</p>
                {active.vendorCount > 0 && (
                  <p className="mt-1 text-sm font-medium text-zinc-400">
                    {active.vendorCount} vendor{active.vendorCount !== 1 ? "s" : ""} · One pickup
                  </p>
                )}
              </div>
            </div>
            {active.description && (
              <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-zinc-500">
                {active.description}
              </p>
            )}
          </div>
          {featuredPods.length > 0 && (
            <div className="mt-8 flex items-center justify-between gap-3 border-t border-zinc-800 pt-5">
              <Link
                href={`/pod/${active.id}`}
                className="text-sm font-semibold text-white underline-offset-4 transition hover:text-brand hover:underline"
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
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-300",
                        i === index ? "w-8 bg-brand" : "w-2 bg-zinc-700 hover:bg-zinc-500"
                      )}
                      aria-label={`Show featured pod ${i + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </PageShell>
    </section>
  );
}

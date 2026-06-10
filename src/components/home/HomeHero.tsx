"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PodLogo } from "@/components/images/PodLogo";
import { PageShell } from "@/components/layout/page-shell";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { HOME_MARKET_IMAGE } from "@/lib/home-assets";
import {
  HOME_HERO_HEADLINE,
  HOME_HERO_SUPPORTING,
  HOME_PRIMARY_CTA_LABEL,
  HOME_SECONDARY_CTA_LABEL,
  homePodOwnerMailtoHref,
} from "@/lib/home-marketing";

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
    name: "Your food pod",
    description: "Multiple vendors, one cart, one checkout, one pickup flow.",
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
    <section className="relative isolate w-full overflow-hidden border-b border-oo-charcoal/30 bg-oo-charcoal text-oo-warm-white">
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-full sm:w-[58%] lg:w-1/2"
        aria-hidden
      >
        <Image
          src={HOME_MARKET_IMAGE}
          alt=""
          fill
          className="object-cover object-center opacity-[0.28] sm:opacity-[0.32]"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 58vw, 50vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-oo-charcoal from-5% via-oo-charcoal/85 via-40% to-oo-charcoal/55" />
        <div className="absolute inset-0 bg-oo-charcoal/45" />
      </div>

      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(105deg, transparent 0%, rgba(249,115,22,0.08) 45%, transparent 70%), radial-gradient(ellipse 80% 50% at 100% 0%, rgba(249,115,22,0.14), transparent 50%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,rgba(31,31,28,0.45)_100%)]"
        aria-hidden
      />

      <PageShell className="relative z-10 grid min-h-[min(88vh,52rem)] gap-12 py-16 sm:py-20 lg:grid-cols-[1.15fr_minmax(0,22rem)] lg:items-end lg:gap-16 lg:py-24 xl:grid-cols-[1.2fr_minmax(0,26rem)]">
        <div className="flex flex-col justify-end animate-oo-fade-up motion-reduce:animate-none">
          <p className="text-[clamp(2rem,6vw,3.25rem)] font-black leading-none tracking-tight text-oo-warm-white">
            Open Order
          </p>
          <p className="mt-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-oo-cream/50">
            <span className="oo-live-dot" aria-hidden />
            Connected ordering for food pods
          </p>
          <h1 className="mt-6 max-w-2xl text-3xl font-black leading-tight tracking-tight text-oo-warm-white sm:text-4xl md:text-[2.75rem] md:leading-[1.1]">
            {HOME_HERO_HEADLINE}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-oo-cream/70 sm:text-xl">
            {HOME_HERO_SUPPORTING}
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <ButtonLink href={homePodOwnerMailtoHref()} size="lg" className="w-full sm:w-auto">
              {HOME_PRIMARY_CTA_LABEL}
            </ButtonLink>
            <ButtonLink
              href="/explore"
              variant="secondary"
              size="lg"
              className="w-full border-oo-cream/40 text-oo-warm-white hover:border-oo-warm-white hover:bg-oo-warm-white hover:text-oo-charcoal sm:w-auto"
            >
              {HOME_SECONDARY_CTA_LABEL}
            </ButtonLink>
          </div>
        </div>

        <div
          className={cn(
            "flex flex-col justify-between rounded-xl border border-oo-light-stone/15 bg-oo-charcoal/90 p-6 shadow-2xl backdrop-blur-sm",
            "animate-oo-fade-up motion-reduce:animate-none [animation-delay:120ms]"
          )}
        >
          <div key={active.id} className="animate-mennyu-fade-in motion-reduce:animate-none">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-oo-cream/50">
              Participating pod
            </p>
            <div className="mt-4 flex gap-4">
              <PodLogo
                imageUrl={active.imageUrl}
                podName={active.name}
                className="h-14 w-14 shrink-0 rounded-lg ring-1 ring-oo-light-stone/25"
                sizes="56px"
              />
              <div className="min-w-0">
                <p className="truncate text-xl font-bold tracking-tight text-oo-warm-white">{active.name}</p>
                {active.vendorCount > 0 && (
                  <p className="mt-1 text-sm font-medium text-oo-cream/65">
                    {active.vendorCount} vendor{active.vendorCount !== 1 ? "s" : ""} · One checkout
                  </p>
                )}
              </div>
            </div>
            {active.description && (
              <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-oo-cream/55">
                {active.description}
              </p>
            )}
          </div>
          {featuredPods.length > 0 && (
            <div className="mt-8 flex items-center justify-between gap-3 border-t border-oo-light-stone/15 pt-5">
              <Link
                href={`/pod/${active.id}`}
                className="text-sm font-semibold text-oo-warm-white underline-offset-4 transition hover:text-brand hover:underline"
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
                        i === index ? "w-8 bg-brand" : "w-2 bg-oo-light-stone/30 hover:bg-oo-cream/50"
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

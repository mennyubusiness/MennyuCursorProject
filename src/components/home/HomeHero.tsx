"use client";

import Image from "next/image";

import { HomeHeroBrand } from "@/components/home/HomeHeroBrand";
import { HomeProductPreview } from "@/components/home/HomeProductPreview";
import { HomeQrCustomerFlow } from "@/components/home/HomeQrCustomerFlow";
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

export function HomeHero() {
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
          className="object-cover object-center opacity-[0.32] sm:opacity-[0.36]"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 58vw, 50vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-oo-charcoal from-0% via-oo-charcoal/92 via-38% to-oo-charcoal/48" />
        <div className="absolute inset-0 bg-oo-charcoal/55" />
      </div>

      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-oo-charcoal/90 via-oo-charcoal/75 to-transparent sm:via-oo-charcoal/55"
        aria-hidden
      />

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

      <PageShell className="relative z-10 grid gap-10 py-14 sm:py-16 lg:grid-cols-[1.1fr_minmax(0,22rem)] lg:items-center lg:gap-14 lg:py-20 xl:grid-cols-[1.15fr_minmax(0,26rem)]">
        <div className="flex flex-col animate-oo-fade-up motion-reduce:animate-none">
          <HomeHeroBrand size="homepage" />

          <h1 className="mt-7 max-w-2xl text-3xl font-black leading-tight tracking-tight text-oo-warm-white sm:mt-10 sm:text-4xl md:text-[2.75rem] md:leading-[1.1]">
            {HOME_HERO_HEADLINE}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-oo-cream/70 sm:mt-6 sm:text-lg">
            {HOME_HERO_SUPPORTING}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:items-center">
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

          <HomeQrCustomerFlow className="mt-8 max-w-2xl" tone="dark" />
        </div>

        <div
          className={cn(
            "animate-oo-fade-up motion-reduce:animate-none [animation-delay:120ms]",
            "mx-auto w-full max-w-md lg:max-w-none"
          )}
        >
          <HomeProductPreview />
        </div>
      </PageShell>
    </section>
  );
}

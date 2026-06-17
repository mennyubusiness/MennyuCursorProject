import Image from "next/image";
import { PageShell } from "@/components/layout/page-shell";
import { DestinationPodHeroActions } from "@/components/pod/destination/DestinationPodHeroActions";
import { DestinationPodMarquee } from "@/components/pod/destination/DestinationPodMarquee";
import { isHttpsImageUrl } from "@/lib/remote-image-url";
import type { PodOrderingStatus } from "@/lib/pod-page-status";
import { podOrderingStatusBadgeClass } from "@/lib/pod-page-status";
import { cn } from "@/lib/cn";

type DestinationPodHeroProps = {
  podId: string;
  name: string;
  tagline: string | null;
  description: string | null;
  address: string | null;
  imageUrl: string | null;
  accentColor: string | null;
  orderingStatus: PodOrderingStatus;
  hasVendors: boolean;
  marqueeItems: string[];
};

const DEFAULT_TAGLINE = "Mix vendors in one cart — one payment, one trip.";

const heroMetaBadge =
  "rounded-full border border-white/25 bg-white/90 px-3 py-1 text-xs font-semibold text-oo-charcoal shadow-sm";

export function DestinationPodHero({
  podId,
  name,
  tagline,
  description,
  address,
  imageUrl,
  accentColor,
  orderingStatus,
  hasVendors,
  marqueeItems,
}: DestinationPodHeroProps) {
  const hasImage = isHttpsImageUrl(imageUrl);
  const heroTagline =
    tagline?.trim() ||
    description?.trim()?.split(/\n/)[0]?.slice(0, 200) ||
    DEFAULT_TAGLINE;
  const storyLine = description?.trim() && tagline?.trim() ? description.trim().split(/\n/)[0]?.slice(0, 220) : null;
  const location = address?.trim();

  return (
    <header id="pod-hero" className="relative isolate overflow-hidden border-b border-oo-light-stone">
      <div className="absolute inset-0 z-0" aria-hidden>
        {hasImage ? (
          <Image
            src={imageUrl!}
            alt=""
            fill
            className="z-0 object-cover"
            sizes="100vw"
            priority
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-oo-charcoal via-[#2a2926] to-brand/30" />
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 z-10 bg-black/50" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-r from-black/90 via-black/65 to-black/25"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent sm:from-black/50 sm:via-transparent sm:to-transparent"
        aria-hidden
      />

      {accentColor && hasImage && (
        <div
          className="pointer-events-none absolute inset-0 z-10 opacity-[0.12] mix-blend-soft-light"
          style={{
            background: `linear-gradient(135deg, ${accentColor} 0%, transparent 55%)`,
          }}
          aria-hidden
        />
      )}

      <PageShell className="relative z-20 py-8 sm:py-12 lg:py-14">
        <div className="max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">
            Destination food pod
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-tight text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.55)] sm:text-5xl lg:text-[3.25rem] lg:leading-[1.05]">
            {name}
          </h1>

          <p className="mt-4 max-w-2xl text-lg font-medium leading-relaxed text-white/95 sm:text-xl">
            {heroTagline}
          </p>

          {storyLine && storyLine !== heroTagline && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/80 sm:text-base">
              {storyLine}
            </p>
          )}

          {location && (
            <p className="mt-3 text-sm leading-relaxed text-white/75 sm:text-base">{location}</p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide shadow-sm",
                podOrderingStatusBadgeClass(orderingStatus.tone)
              )}
            >
              {(orderingStatus.tone === "open" || orderingStatus.tone === "limited") && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" aria-hidden />
              )}
              {orderingStatus.label}
            </span>
            {orderingStatus.totalVendorCount > 0 && (
              <span className={heroMetaBadge}>
                {orderingStatus.totalVendorCount} vendor
                {orderingStatus.totalVendorCount === 1 ? "" : "s"}
              </span>
            )}
            <span className={heroMetaBadge}>One cart · One checkout</span>
          </div>

          <div className="mt-7">
            <DestinationPodHeroActions podId={podId} hasVendors={hasVendors} address={address} />
          </div>
        </div>
      </PageShell>

      {marqueeItems.length > 0 && <DestinationPodMarquee items={marqueeItems} />}
    </header>
  );
}

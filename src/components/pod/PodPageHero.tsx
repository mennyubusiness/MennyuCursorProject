import Image from "next/image";
import { PageShell } from "@/components/layout/page-shell";
import { PodPageHeroActions } from "@/components/pod/PodPageHeroActions";
import { isHttpsImageUrl } from "@/lib/remote-image-url";
import type { PodOrderingStatus } from "@/lib/pod-page-status";
import { podOrderingStatusBadgeClass } from "@/lib/pod-page-status";
import { cn } from "@/lib/cn";
import { FULL_BLEED_VIEWPORT_CLASS } from "@/lib/full-bleed-layout";

type PodPageHeroProps = {
  podId: string;
  name: string;
  tagline: string | null;
  description: string | null;
  address: string | null;
  imageUrl: string | null;
  accentColor: string | null;
  orderingStatus: PodOrderingStatus;
  hasVendors: boolean;
  /** False on a fully menu-only pod: there is nothing to group-order. */
  showGroupOrderCta?: boolean;
};

const DEFAULT_TAGLINE = "Mix vendors in one cart — one payment, one trip.";
const DEFAULT_MENU_ONLY_TAGLINE = "Browse every kitchen's menu in one place.";

const heroMetaBadge =
  "rounded-full border border-white/25 bg-white/90 px-3 py-1 text-xs font-semibold text-oo-charcoal shadow-sm";

export function PodPageHero({
  podId,
  name,
  tagline,
  description,
  address,
  imageUrl,
  accentColor,
  orderingStatus,
  hasVendors,
  showGroupOrderCta = true,
}: PodPageHeroProps) {
  const hasImage = isHttpsImageUrl(imageUrl);
  const menuOnly = orderingStatus.tone === "menu_only";
  const heroTagline =
    tagline?.trim() ||
    description?.trim()?.split(/\n/)[0]?.slice(0, 160) ||
    (menuOnly ? DEFAULT_MENU_ONLY_TAGLINE : DEFAULT_TAGLINE);
  const location = address?.trim();

  return (
    <header
      id="pod-hero"
      className={cn(
        FULL_BLEED_VIEWPORT_CLASS,
        "isolate w-full overflow-hidden border-b border-oo-light-stone"
      )}
    >
      {/* Layer 0: banner image or fallback fill */}
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
          <div className="h-full w-full bg-gradient-to-br from-oo-charcoal via-[#2a2926] to-[#1a1917]" />
        )}
      </div>

      {/* Layer 10: balanced full-area tint */}
      <div className="pointer-events-none absolute inset-0 z-10 bg-black/45" aria-hidden />

      {/* Layer 10: stronger left-side gradient behind text — no visible content card */}
      <div
        className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-r from-black/85 via-black/60 to-black/20"
        aria-hidden
      />

      {/* Layer 10: mobile bottom gradient for stacked text */}
      <div
        className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/70 via-black/35 to-transparent sm:from-black/40 sm:via-transparent sm:to-transparent"
        aria-hidden
      />

      {accentColor && hasImage && (
        <div
          className="pointer-events-none absolute inset-0 z-10 opacity-[0.1] mix-blend-soft-light"
          style={{
            background: `linear-gradient(135deg, ${accentColor} 0%, transparent 50%)`,
          }}
          aria-hidden
        />
      )}

      {/* Layer 20: hero content — no card wrapper, sits directly on gradient */}
      <PageShell className="relative z-20 py-8 sm:py-10 lg:py-12">
        <div className="max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">
            Food pod
          </p>

          <h1 className="mt-2 text-3xl font-black tracking-tight text-white [text-shadow:0_2px_20px_rgba(0,0,0,0.5)] sm:text-4xl lg:text-[2.75rem]">
            {name}
          </h1>

          <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/90 sm:text-lg">
            {heroTagline}
          </p>

          {location && (
            <p className="mt-2 text-sm leading-relaxed text-white/75">{location}</p>
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
            {!menuOnly && <span className={heroMetaBadge}>One cart · One pickup</span>}
          </div>

          <div className="mt-6">
            <PodPageHeroActions
              podId={podId}
              hasVendors={hasVendors}
              showGroupOrderCta={showGroupOrderCta}
            />
          </div>
        </div>
      </PageShell>
    </header>
  );
}

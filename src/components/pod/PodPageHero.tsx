import Image from "next/image";
import Link from "next/link";
import { FavoritePodButton } from "@/components/retention/FavoritePodButton";
import { PageShell } from "@/components/layout/page-shell";
import { ButtonLink, buttonClassName } from "@/components/ui/button";
import { isHttpsImageUrl } from "@/lib/remote-image-url";
import type { PodOrderingStatus } from "@/lib/pod-page-status";
import { podOrderingStatusBadgeClass } from "@/lib/pod-page-status";
import { cn } from "@/lib/cn";

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
  groupOrderHref: string;
};

const DEFAULT_TAGLINE = "Mix vendors in one cart — one payment, one trip.";

const heroSaveButton =
  "shrink-0 !h-9 !border-oo-light-stone/80 !bg-oo-warm-white/90 !px-3 !text-oo-charcoal shadow-sm hover:!border-oo-warm-white hover:!bg-oo-warm-white focus-visible:!outline-brand";

const heroMetaBadge =
  "rounded-full border border-white/25 bg-white/90 px-3 py-1 text-xs font-semibold text-oo-charcoal shadow-sm";

const heroSecondaryCta = cn(
  buttonClassName({ variant: "outline", size: "md" }),
  "min-h-11 border-white/80 bg-oo-warm-white/90 text-oo-charcoal shadow-sm hover:border-oo-warm-white hover:bg-oo-warm-white"
);

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
  groupOrderHref,
}: PodPageHeroProps) {
  const hasImage = isHttpsImageUrl(imageUrl);
  const heroTagline =
    tagline?.trim() ||
    description?.trim()?.split(/\n/)[0]?.slice(0, 160) ||
    DEFAULT_TAGLINE;
  const location = address?.trim();

  const vendorCtaLabel = hasVendors
    ? orderingStatus.tone === "closed"
      ? "Browse vendors"
      : "Start order"
    : "Explore pods";
  const vendorCtaHref = hasVendors ? "#pod-vendors" : "/explore";

  return (
    <header id="pod-hero" className="relative isolate overflow-hidden border-b border-oo-light-stone">
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

      {/* Layer 10: lighter full-area tint — image stays recognizable */}
      <div className="pointer-events-none absolute inset-0 z-10 bg-black/45" aria-hidden />

      {/* Layer 10: darker left side behind text */}
      <div
        className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-r from-black/80 via-black/55 to-black/20"
        aria-hidden
      />

      {/* Layer 10: mobile bottom gradient for stacked text */}
      <div
        className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/65 via-black/30 to-transparent sm:from-black/35 sm:via-transparent sm:to-transparent"
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

      {/* Layer 20: hero content above overlays */}
      <PageShell className="relative z-20 py-8 sm:py-10 lg:py-12">
        <div className="max-w-3xl rounded-2xl bg-black/20 p-4 sm:p-6 lg:bg-black/15 lg:p-0 lg:rounded-none">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">
            Food pod
          </p>

          <div className="mt-2 flex items-start justify-between gap-4">
            <h1 className="min-w-0 text-3xl font-black tracking-tight text-white [text-shadow:0_2px_20px_rgba(0,0,0,0.5)] sm:text-4xl lg:text-[2.75rem]">
              {name}
            </h1>
            <FavoritePodButton
              podId={podId}
              podName={name}
              labeled
              className={cn(heroSaveButton, "hidden sm:inline-flex")}
            />
          </div>

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
            <span className={heroMetaBadge}>One cart · One pickup</span>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              href={vendorCtaHref}
              className={cn(
                buttonClassName({ variant: "primary", size: "md" }),
                "min-h-11 shadow-[0_0_20px_rgba(249,115,22,0.35)]"
              )}
            >
              {vendorCtaLabel}
            </a>
            {hasVendors && (
              <Link href={groupOrderHref} className={heroSecondaryCta}>
                Start group order
              </Link>
            )}
            {!hasVendors && (
              <ButtonLink href="/explore" className={heroSecondaryCta}>
                Find another pod
              </ButtonLink>
            )}
            <FavoritePodButton
              podId={podId}
              podName={name}
              labeled
              className={cn(heroSaveButton, "sm:hidden")}
            />
          </div>
        </div>
      </PageShell>
    </header>
  );
}

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
    <header id="pod-hero" className="relative overflow-hidden border-b border-oo-light-stone">
      <div className="absolute inset-0" aria-hidden>
        {hasImage ? (
          <Image src={imageUrl!} alt="" fill className="object-cover" sizes="100vw" priority />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-oo-charcoal via-[#2a2926] to-[#1a1917]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-oo-charcoal/90 via-oo-charcoal/55 to-oo-charcoal/35" />
        {accentColor && (
          <div
            className="absolute inset-0 opacity-25 mix-blend-soft-light"
            style={{
              background: `linear-gradient(135deg, ${accentColor} 0%, transparent 55%)`,
            }}
          />
        )}
      </div>

      <PageShell className="relative z-10 py-8 sm:py-10 lg:py-12">
        <div className="max-w-3xl">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-oo-cream/80">
              Food pod
            </p>
            <FavoritePodButton
              podId={podId}
              podName={name}
              labeled
              className="shrink-0 !border-oo-warm-white/25 !bg-oo-charcoal/40 !text-oo-warm-white backdrop-blur-sm hover:!bg-oo-charcoal/55"
            />
          </div>

          <h1 className="mt-2 text-3xl font-black tracking-tight text-oo-warm-white sm:text-4xl lg:text-[2.75rem]">
            {name}
          </h1>

          <p className="mt-3 max-w-2xl text-base leading-relaxed text-oo-cream/90 sm:text-lg">
            {heroTagline}
          </p>

          {location && (
            <p className="mt-3 text-sm text-oo-cream/80">{location}</p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide",
                podOrderingStatusBadgeClass(orderingStatus.tone)
              )}
            >
              {(orderingStatus.tone === "open" || orderingStatus.tone === "limited") && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
              )}
              {orderingStatus.label}
            </span>
            {orderingStatus.totalVendorCount > 0 && (
              <span className="rounded-full border border-oo-warm-white/20 bg-oo-charcoal/35 px-3 py-1 text-xs font-medium text-oo-warm-white backdrop-blur-sm">
                {orderingStatus.totalVendorCount} vendor
                {orderingStatus.totalVendorCount === 1 ? "" : "s"}
              </span>
            )}
            <span className="rounded-full border border-oo-warm-white/20 bg-oo-charcoal/35 px-3 py-1 text-xs font-medium text-oo-warm-white backdrop-blur-sm">
              One cart · One pickup
            </span>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
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
              <Link
                href={groupOrderHref}
                className={cn(
                  buttonClassName({ variant: "ghost-light", size: "md" }),
                  "min-h-11 border border-oo-warm-white/25 bg-oo-charcoal/30 backdrop-blur-sm"
                )}
              >
                Start group order
              </Link>
            )}
            {!hasVendors && (
              <ButtonLink href="/explore" variant="ghost-light" size="md" className="min-h-11 border border-oo-warm-white/25 bg-oo-charcoal/30">
                Find another pod
              </ButtonLink>
            )}
          </div>
        </div>
      </PageShell>
    </header>
  );
}

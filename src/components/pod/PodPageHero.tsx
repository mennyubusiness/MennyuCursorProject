import Image from "next/image";
import { FavoritePodButton } from "@/components/retention/FavoritePodButton";
import { PageShell } from "@/components/layout/page-shell";
import { isHttpsImageUrl } from "@/lib/remote-image-url";
import { cn } from "@/lib/cn";

type PodPageHeroProps = {
  podId: string;
  name: string;
  description: string | null;
  address: string | null;
  imageUrl: string | null;
  accentColor: string | null;
  vendorCount: number;
};

export function PodPageHero({
  podId,
  name,
  description,
  address,
  imageUrl,
  accentColor,
  vendorCount,
}: PodPageHeroProps) {
  const hasImage = isHttpsImageUrl(imageUrl);
  const defaultTagline = "Mix vendors in one cart — one payment, one trip.";
  const tagline = description?.trim() ?? defaultTagline;

  const countLabel =
    vendorCount === 0
      ? "No vendors yet"
      : `${vendorCount} vendor${vendorCount === 1 ? "" : "s"}`;

  return (
    <header className="border-b border-oo-light-stone bg-oo-warm-white">
      <PageShell className="py-5 sm:py-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6 lg:gap-8">
          <div
            className={cn(
              "relative aspect-[16/9] w-full shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 shadow-sm sm:aspect-[5/3] sm:w-56 lg:w-64",
              accentColor && "ring-1 ring-inset ring-black/5"
            )}
            style={
              accentColor
                ? { boxShadow: `inset 4px 0 0 0 ${accentColor}` }
                : undefined
            }
          >
            {hasImage ? (
              <Image
                src={imageUrl!}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 256px"
                priority
              />
            ) : (
              <div
                className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-700 to-zinc-900"
                aria-hidden
              />
            )}
            {accentColor && (
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.14]"
                style={{
                  background: `linear-gradient(135deg, ${accentColor} 0%, transparent 60%)`,
                }}
                aria-hidden
              />
            )}
            <div className="absolute bottom-2 left-2 flex flex-wrap gap-1.5">
              <span className="oo-badge-live text-[10px] shadow-md">{countLabel}</span>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-oo-stone-gray">
                  Food pod
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-oo-charcoal sm:text-3xl">
                  {name}
                </h1>
              </div>
              <FavoritePodButton
                podId={podId}
                podName={name}
                labeled
                className="shrink-0 !border-oo-light-stone !bg-oo-warm-white !text-oo-charcoal shadow-sm hover:!bg-oo-cream"
              />
            </div>

            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-oo-stone-gray sm:text-base">
              {tagline}
            </p>

            {address?.trim() && (
              <p className="mt-2 text-sm text-oo-stone-gray">{address}</p>
            )}

            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Pod details">
              <li>
                <span className="oo-badge-muted">{countLabel}</span>
              </li>
              <li>
                <span className="oo-badge-muted">One pickup</span>
              </li>
              <li>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-oo-charcoal px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-oo-warm-white">
                  <span className="oo-live-dot" aria-hidden />
                  Live
                </span>
              </li>
            </ul>
          </div>
        </div>
      </PageShell>
    </header>
  );
}

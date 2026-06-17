import Image from "next/image";

import { DestinationPodMarquee } from "@/components/pod/destination/DestinationPodMarquee";
import { isHttpsImageUrl } from "@/lib/remote-image-url";

type DestinationPodHeroProps = {
  name: string;
  tagline: string | null;
  imageUrl: string | null;
  accentColor: string | null;
  marqueeItems: string[];
};

export function DestinationPodHero({
  name,
  tagline,
  imageUrl,
  accentColor,
  marqueeItems,
}: DestinationPodHeroProps) {
  const hasImage = isHttpsImageUrl(imageUrl);
  const shortTagline = tagline?.trim() || null;

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
          <div className="h-full w-full bg-gradient-to-br from-oo-charcoal via-[#2a2926] to-brand/25" />
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 z-10 bg-black/55" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-black/35 via-black/50 to-black/65"
        aria-hidden
      />

      {accentColor && hasImage && (
        <div
          className="pointer-events-none absolute inset-0 z-10 opacity-[0.08] mix-blend-soft-light"
          style={{
            background: `linear-gradient(135deg, ${accentColor} 0%, transparent 60%)`,
          }}
          aria-hidden
        />
      )}

      <div className="relative z-20 flex min-h-[min(38vh,280px)] items-center justify-center px-4 py-10 sm:min-h-[min(42vh,340px)] sm:px-6 sm:py-12">
        <div className="max-w-4xl text-center">
          <h1 className="text-balance text-4xl font-black tracking-tight text-oo-warm-white [text-shadow:0_2px_28px_rgba(0,0,0,0.65)] sm:text-5xl lg:text-6xl">
            {name}
          </h1>
          {shortTagline ? (
            <p className="mx-auto mt-3 max-w-xl text-base font-medium leading-relaxed text-white/90 [text-shadow:0_1px_16px_rgba(0,0,0,0.55)] sm:text-lg">
              {shortTagline}
            </p>
          ) : null}
        </div>
      </div>

      {marqueeItems.length > 0 && <DestinationPodMarquee items={marqueeItems} />}
    </header>
  );
}

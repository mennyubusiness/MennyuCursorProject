import Image from "next/image";
import { FavoritePodButton } from "@/components/retention/FavoritePodButton";
import { isHttpsImageUrl } from "@/lib/remote-image-url";

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

  const countLine =
    vendorCount === 0
      ? "No vendors listed yet"
      : `${vendorCount} vendor${vendorCount === 1 ? "" : "s"} · One pickup`;

  return (
    <div className="relative isolate overflow-hidden rounded-2xl border border-stone-300/50 shadow-lg">
      {hasImage ? (
        <div className="absolute inset-0">
          <Image
            src={imageUrl!}
            alt=""
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
        </div>
      ) : (
        <div
          className="absolute inset-0 bg-gradient-to-br from-stone-800 via-stone-700 to-stone-900"
          aria-hidden
        />
      )}
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/45 to-black/25"
        aria-hidden
      />
      {accentColor && (
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{ background: `linear-gradient(135deg, ${accentColor} 0%, transparent 55%)` }}
          aria-hidden
        />
      )}

      <div className="relative flex min-h-[220px] flex-col justify-end px-5 py-8 sm:min-h-[240px] sm:px-8 sm:py-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-300">Food pod</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">{name}</h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-stone-200 sm:text-lg">
              {description?.trim() ?? defaultTagline}
            </p>
            {address?.trim() && (
              <p className="mt-2 max-w-2xl text-sm text-stone-400">{address}</p>
            )}
            <p className="mt-4 text-sm font-medium text-white/95">{countLine}</p>
          </div>
          <FavoritePodButton
            podId={podId}
            podName={name}
            labeled
            className="shrink-0 !border-white/40 !bg-black/35 !text-white shadow-md backdrop-blur-md hover:!bg-black/50"
          />
        </div>
      </div>
    </div>
  );
}

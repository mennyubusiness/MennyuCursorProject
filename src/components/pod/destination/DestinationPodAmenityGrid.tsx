import type { PodAmenityId } from "@/lib/pod-amenities";
import { formatPodAmenitiesForDisplay } from "@/lib/pod-amenities";
import { cn } from "@/lib/cn";

const AMENITY_ICONS: Partial<Record<PodAmenityId, string>> = {
  outdoor_seating: "☀️",
  covered_seating: "⛱️",
  bar: "🍹",
  family_friendly: "👨‍👩‍👧",
  pet_friendly: "🐾",
  parking: "🅿️",
  restrooms: "🚻",
  events: "🎉",
  games: "🕹️",
};

type DestinationPodAmenityGridProps = {
  amenities: PodAmenityId[];
  className?: string;
};

export function DestinationPodAmenityGrid({ amenities, className }: DestinationPodAmenityGridProps) {
  const items = formatPodAmenitiesForDisplay(amenities);
  if (items.length === 0) return null;

  return (
    <div className={cn(className)}>
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-oo-stone-gray">
        Amenities & accessibility
      </p>
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map(({ id, label }) => (
          <li
            key={id}
            className="rounded-xl border border-oo-light-stone bg-oo-warm-white px-3 py-3 text-sm shadow-sm"
          >
            <span className="text-lg" aria-hidden>
              {AMENITY_ICONS[id] ?? "✓"}
            </span>
            <p className="mt-1 font-semibold leading-snug text-oo-charcoal">{label}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

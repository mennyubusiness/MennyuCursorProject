import type { PodAmenityId } from "@/lib/pod-amenities";
import { formatPodAmenitiesForDisplay } from "@/lib/pod-amenities";
import { PageShell } from "@/components/layout/page-shell";
import { cn } from "@/lib/cn";

type PodPageIdentitySectionProps = {
  description: string | null;
  amenities: PodAmenityId[];
  address: string | null;
};

export function PodPageIdentitySection({
  description,
  amenities,
  address,
}: PodPageIdentitySectionProps) {
  const about = description?.trim();
  const amenityItems = formatPodAmenitiesForDisplay(amenities);
  const location = address?.trim();

  if (!about && amenityItems.length === 0) return null;

  return (
    <section id="pod-about" aria-labelledby="pod-about-heading" className="scroll-mt-36 border-b border-oo-light-stone bg-oo-cream/60">
      <PageShell className="py-5 sm:py-6">
        <h2 id="pod-about-heading" className="sr-only">
          About this pod
        </h2>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-10">
          {about && (
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-oo-stone-gray">
                About
              </p>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-oo-charcoal sm:text-base">
                {about}
              </p>
            </div>
          )}
          {(amenityItems.length > 0 || location) && (
            <div className={cn("shrink-0", about ? "lg:max-w-sm lg:border-l lg:border-oo-light-stone lg:pl-8" : "w-full")}>
              {location && !about && (
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-oo-stone-gray">
                  Location
                </p>
              )}
              {location && !about && (
                <p className="mt-2 text-sm text-oo-charcoal">{location}</p>
              )}
              {amenityItems.length > 0 && (
                <>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-oo-stone-gray">
                    Amenities
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-2" aria-label="Pod amenities">
                    {amenityItems.map(({ id, label }) => (
                      <li key={id}>
                        <span className="inline-flex rounded-full border border-oo-light-stone bg-oo-warm-white px-2.5 py-1 text-xs font-medium text-oo-charcoal">
                          {label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      </PageShell>
    </section>
  );
}

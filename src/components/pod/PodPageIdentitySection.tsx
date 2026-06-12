import type { PodAmenityId } from "@/lib/pod-amenities";
import { formatPodAmenitiesForDisplay } from "@/lib/pod-amenities";
import { PageBand, PageShell } from "@/components/layout/page-shell";

type PodPageIdentitySectionProps = {
  podName: string;
  tagline: string | null;
  description: string | null;
  amenities: PodAmenityId[];
};

export function PodPageIdentitySection({
  podName,
  tagline,
  description,
  amenities,
}: PodPageIdentitySectionProps) {
  const about = description?.trim();
  const shortTagline = tagline?.trim();
  const amenityItems = formatPodAmenitiesForDisplay(amenities);

  if (!about && !shortTagline && amenityItems.length === 0) return null;

  return (
    <PageBand variant="muted" className="border-t-0">
      <section id="pod-about" aria-labelledby="pod-about-heading" className="scroll-mt-36">
        <PageShell className="py-8 sm:py-10">
          <header className="mb-5 max-w-2xl">
            <h2 id="pod-about-heading" className="text-xl font-bold tracking-tight text-oo-charcoal sm:text-2xl">
              About {podName}
            </h2>
            {shortTagline && (
              <p className="mt-2 text-base font-medium text-oo-charcoal">{shortTagline}</p>
            )}
          </header>

          {about && (
            <p className="max-w-3xl text-sm leading-relaxed text-oo-stone-gray sm:text-base">{about}</p>
          )}

          {amenityItems.length > 0 && (
            <div className={about ? "mt-6" : ""}>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-oo-stone-gray">
                Amenities
              </p>
              <ul className="mt-3 flex flex-wrap gap-2" aria-label="Pod amenities">
                {amenityItems.map(({ id, label }) => (
                  <li key={id}>
                    <span className="inline-flex rounded-full border border-oo-light-stone bg-oo-warm-white px-3 py-1.5 text-xs font-semibold text-oo-charcoal shadow-sm">
                      {label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </PageShell>
      </section>
    </PageBand>
  );
}

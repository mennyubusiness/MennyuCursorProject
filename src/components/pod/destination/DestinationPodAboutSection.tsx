import type { PodAmenityId } from "@/lib/pod-amenities";
import { formatPodAmenitiesForDisplay } from "@/lib/pod-amenities";
import { PageBand, PageShell } from "@/components/layout/page-shell";
import { DestinationPodAmenityGrid } from "@/components/pod/destination/DestinationPodAmenityGrid";

type DestinationPodAboutSectionProps = {
  podName: string;
  tagline: string | null;
  description: string | null;
  ownerContactName: string | null;
  address: string | null;
  amenities: PodAmenityId[];
};

export function DestinationPodAboutSection({
  podName,
  tagline,
  description,
  ownerContactName,
  address,
  amenities,
}: DestinationPodAboutSectionProps) {
  const about = description?.trim();
  const shortTagline = tagline?.trim();
  const operator = ownerContactName?.trim();
  const neighborhood = address?.trim();
  const amenityItems = formatPodAmenitiesForDisplay(amenities);

  const hasBody = Boolean(about || shortTagline || operator || amenityItems.length > 0);
  if (!hasBody) return null;

  return (
    <PageBand variant="muted" className="border-t-0">
      <section id="pod-about" aria-labelledby="pod-about-heading" className="scroll-mt-36">
        <PageShell className="py-8 sm:py-10">
          <header className="mb-5 max-w-2xl">
            <h2
              id="pod-about-heading"
              className="text-2xl font-bold tracking-tight text-oo-charcoal sm:text-3xl"
            >
              About {podName}
            </h2>
            {shortTagline && (
              <p className="mt-2 text-base font-medium text-oo-charcoal sm:text-lg">{shortTagline}</p>
            )}
          </header>

          {about && (
            <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-oo-stone-gray sm:text-base">
              {about}
            </p>
          )}

          {operator && (
            <p className="mt-4 text-sm text-oo-stone-gray">
              <span className="font-semibold text-oo-charcoal">Operated by </span>
              {operator}
            </p>
          )}

          {neighborhood && (
            <p className="mt-2 text-sm text-oo-stone-gray">
              <span className="font-semibold text-oo-charcoal">Located at </span>
              {neighborhood}
            </p>
          )}

          {amenityItems.length > 0 && (
            <div className={about || operator ? "mt-8" : "mt-2"}>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-oo-stone-gray">
                Known for
              </p>
              <ul className="mt-3 flex flex-wrap gap-2" aria-label="Pod highlights">
                {amenityItems.map(({ id, label }) => (
                  <li key={id}>
                    <span className="inline-flex rounded-full border border-oo-light-stone bg-oo-warm-white px-3 py-1.5 text-xs font-semibold text-oo-charcoal shadow-sm">
                      {label}
                    </span>
                  </li>
                ))}
              </ul>
              <DestinationPodAmenityGrid amenities={amenities} className="mt-6" />
            </div>
          )}
        </PageShell>
      </section>
    </PageBand>
  );
}

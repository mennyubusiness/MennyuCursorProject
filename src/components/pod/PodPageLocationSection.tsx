import { PageSection, PageShell } from "@/components/layout/page-shell";
import { ButtonLink } from "@/components/ui/button";
import { buildDirectionsUrl } from "@/lib/pod-contact-links";

type PodPageLocationSectionProps = {
  podName: string;
  address: string;
  pickupInstructions: string | null;
};

export function PodPageLocationSection({
  podName,
  address,
  pickupInstructions,
}: PodPageLocationSectionProps) {
  const location = address.trim();
  const pickup = pickupInstructions?.trim();
  if (!location) return null;

  const directionsUrl = buildDirectionsUrl(location);

  return (
    <PageSection className="!py-8 sm:!py-10">
      <PageShell>
        <section id="pod-location" aria-labelledby="pod-location-heading" className="scroll-mt-36">
          <header className="mb-5 max-w-2xl">
            <h2 id="pod-location-heading" className="text-xl font-bold tracking-tight text-oo-charcoal sm:text-2xl">
              Visit {podName}
            </h2>
            <p className="mt-2 text-sm text-oo-stone-gray">Find the pod and plan your pickup.</p>
          </header>

          <div className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-oo-stone-gray">Address</p>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-oo-charcoal sm:text-base">
              {location}
            </p>

            {pickup && (
              <div className="mt-5 border-t border-oo-light-stone pt-5">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-oo-stone-gray">
                  Pickup instructions
                </p>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-oo-stone-gray">
                  {pickup}
                </p>
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <ButtonLink href={directionsUrl} variant="primary" size="sm" target="_blank" rel="noopener noreferrer">
                Get directions
              </ButtonLink>
            </div>
          </div>
        </section>
      </PageShell>
    </PageSection>
  );
}

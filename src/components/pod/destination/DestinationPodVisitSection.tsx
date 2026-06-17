import type { PodContactInfo } from "@/components/pod/PodPageContactSection";
import { PageSection, PageShell } from "@/components/layout/page-shell";
import { ButtonLink } from "@/components/ui/button";
import {
  buildDirectionsUrl,
  buildMailtoHref,
  buildTelHref,
  formatInstagramHandle,
} from "@/lib/pod-contact-links";

type DestinationPodVisitSectionProps = {
  podName: string;
  address: string | null;
  pickupInstructions: string | null;
  contact: PodContactInfo;
};

function VisitRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-[0.12em] text-oo-stone-gray">{label}</dt>
      <dd className="mt-1.5 text-sm text-oo-charcoal sm:text-base">{children}</dd>
    </div>
  );
}

export function DestinationPodVisitSection({
  podName,
  address,
  pickupInstructions,
  contact,
}: DestinationPodVisitSectionProps) {
  const location = address?.trim();
  const pickup = pickupInstructions?.trim();
  const email = contact.contactEmail?.trim();
  const phone = contact.contactPhone?.trim();
  const website = contact.websiteUrl?.trim();
  const instagram = contact.instagramUrl?.trim();

  const hasAny = Boolean(location || pickup || email || phone || website || instagram);
  if (!hasAny) return null;

  const directionsUrl = location ? buildDirectionsUrl(location) : null;

  return (
    <PageSection className="!py-8 sm:!py-10">
      <PageShell>
        <section id="pod-visit" aria-labelledby="pod-visit-heading" className="scroll-mt-36">
          <header className="mb-5 max-w-2xl">
            <h2
              id="pod-visit-heading"
              className="text-2xl font-bold tracking-tight text-oo-charcoal sm:text-3xl"
            >
              Visit {podName}
            </h2>
            <p className="mt-2 text-sm text-oo-stone-gray sm:text-base">
              Plan your pickup and find ways to reach the pod team.
            </p>
          </header>

          <div className="rounded-2xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm sm:p-7">
            <dl className="grid gap-5 sm:grid-cols-2">
              {location && (
                <VisitRow label="Address">
                  <p className="whitespace-pre-line leading-relaxed">{location}</p>
                </VisitRow>
              )}
              {pickup && (
                <VisitRow label="Pickup instructions">
                  <p className="whitespace-pre-line leading-relaxed text-oo-stone-gray">{pickup}</p>
                </VisitRow>
              )}
              {phone && (
                <VisitRow label="Phone">
                  <a href={buildTelHref(phone)} className="font-medium underline-offset-2 hover:underline">
                    {phone}
                  </a>
                </VisitRow>
              )}
              {email && (
                <VisitRow label="Email">
                  <a href={buildMailtoHref(email)} className="font-medium underline-offset-2 hover:underline">
                    {email}
                  </a>
                </VisitRow>
              )}
              {website && (
                <VisitRow label="Website">
                  <a
                    href={website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {website.replace(/^https?:\/\//i, "")}
                  </a>
                </VisitRow>
              )}
              {instagram && (
                <VisitRow label="Instagram">
                  <a
                    href={
                      instagram.startsWith("http")
                        ? instagram
                        : `https://instagram.com/${formatInstagramHandle(instagram)}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    @{formatInstagramHandle(instagram)}
                  </a>
                </VisitRow>
              )}
            </dl>

            <div className="mt-6 flex flex-wrap gap-3 border-t border-oo-light-stone pt-5">
              {directionsUrl && (
                <ButtonLink
                  href={directionsUrl}
                  variant="primary"
                  size="sm"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Get directions
                </ButtonLink>
              )}
              {email && (
                <ButtonLink href={buildMailtoHref(email)} variant="outline" size="sm">
                  Contact pod
                </ButtonLink>
              )}
              {website && (
                <ButtonLink
                  href={website}
                  variant="outline"
                  size="sm"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Visit website
                </ButtonLink>
              )}
            </div>
          </div>
        </section>
      </PageShell>
    </PageSection>
  );
}

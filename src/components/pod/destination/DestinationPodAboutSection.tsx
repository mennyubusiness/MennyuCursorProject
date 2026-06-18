import type { PodContactInfo } from "@/components/pod/PodPageContactSection";
import type { PodAmenityId } from "@/lib/pod-amenities";
import { formatPodAmenitiesForDisplay } from "@/lib/pod-amenities";
import {
  buildDirectionsUrl,
  buildMailtoHref,
  buildTelHref,
  formatInstagramHandle,
} from "@/lib/pod-contact-links";
import { cn } from "@/lib/cn";
import { PageSection, PageShell } from "@/components/layout/page-shell";
import { ButtonLink } from "@/components/ui/button";
import { DestinationPodAmenityGrid } from "@/components/pod/destination/DestinationPodAmenityGrid";

type DestinationPodAboutSectionProps = {
  podName: string;
  description: string | null;
  ownerContactName: string | null;
  address: string | null;
  pickupInstructions: string | null;
  amenities: PodAmenityId[];
  contact: PodContactInfo;
};

function AboutRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-[0.12em] text-oo-stone-gray">{label}</dt>
      <dd className="mt-1.5 text-sm text-oo-charcoal sm:text-base">{children}</dd>
    </div>
  );
}

export function DestinationPodAboutSection({
  podName,
  description,
  ownerContactName,
  address,
  pickupInstructions,
  amenities,
  contact,
}: DestinationPodAboutSectionProps) {
  const about = description?.trim();
  const operator = ownerContactName?.trim();
  const location = address?.trim();
  const pickup = pickupInstructions?.trim();
  const email = contact.contactEmail?.trim();
  const phone = contact.contactPhone?.trim();
  const website = contact.websiteUrl?.trim();
  const instagram = contact.instagramUrl?.trim();
  const amenityItems = formatPodAmenitiesForDisplay(amenities);

  const hasContactBlock = Boolean(location || pickup || email || phone || website || instagram);
  const hasBody = Boolean(about || operator || amenityItems.length > 0 || hasContactBlock);
  if (!hasBody) return null;

  const directionsUrl = location ? buildDirectionsUrl(location) : null;

  return (
    <PageSection className="!py-8 sm:!py-10">
      <PageShell>
        <section id="pod-about" aria-labelledby="pod-about-heading" className="scroll-mt-36">
          <header className="mb-5 max-w-2xl">
            <h2
              id="pod-about-heading"
              className="text-2xl font-bold tracking-tight text-oo-charcoal sm:text-3xl"
            >
              About {podName}
            </h2>
          </header>

          {about && (
            <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-oo-stone-gray sm:text-base">
              {about}
            </p>
          )}

          {operator && (
            <p className={cn("text-sm text-oo-stone-gray", about ? "mt-4" : "mt-0")}>
              <span className="font-semibold text-oo-charcoal">Operated by </span>
              {operator}
            </p>
          )}

          {amenityItems.length > 0 && (
            <div className={about || operator ? "mt-6" : "mt-0"}>
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

          {hasContactBlock && (
            <div
              className={cn(
                "rounded-2xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm sm:p-7",
                about || operator || amenityItems.length > 0 ? "mt-8" : "mt-0"
              )}
            >
              <dl className="grid gap-5 sm:grid-cols-2">
                {location && (
                  <AboutRow label="Address">
                    <p className="whitespace-pre-line leading-relaxed">{location}</p>
                  </AboutRow>
                )}
                {pickup && (
                  <AboutRow label="Pickup instructions">
                    <p className="whitespace-pre-line leading-relaxed text-oo-stone-gray">{pickup}</p>
                  </AboutRow>
                )}
                {phone && (
                  <AboutRow label="Phone">
                    <a href={buildTelHref(phone)} className="font-medium underline-offset-2 hover:underline">
                      {phone}
                    </a>
                  </AboutRow>
                )}
                {email && (
                  <AboutRow label="Email">
                    <a href={buildMailtoHref(email)} className="font-medium underline-offset-2 hover:underline">
                      {email}
                    </a>
                  </AboutRow>
                )}
                {website && (
                  <AboutRow label="Website">
                    <a
                      href={website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {website.replace(/^https?:\/\//i, "")}
                    </a>
                  </AboutRow>
                )}
                {instagram && (
                  <AboutRow label="Instagram">
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
                  </AboutRow>
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
          )}
        </section>
      </PageShell>
    </PageSection>
  );
}

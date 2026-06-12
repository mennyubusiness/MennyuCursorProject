import { PageBand, PageShell } from "@/components/layout/page-shell";
import { ButtonLink } from "@/components/ui/button";
import {
  buildMailtoHref,
  buildTelHref,
  formatInstagramHandle,
} from "@/lib/pod-contact-links";

export type PodContactInfo = {
  contactEmail: string | null;
  contactPhone: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
};

function ContactRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-[0.12em] text-oo-stone-gray">{label}</dt>
      <dd className="mt-1.5 text-sm text-oo-charcoal">{children}</dd>
    </div>
  );
}

export function PodPageContactSection({ contact }: { contact: PodContactInfo }) {
  const email = contact.contactEmail?.trim();
  const phone = contact.contactPhone?.trim();
  const website = contact.websiteUrl?.trim();
  const instagram = contact.instagramUrl?.trim();

  const hasAny = Boolean(email || phone || website || instagram);
  if (!hasAny) return null;

  return (
    <PageBand variant="light" className="border-t-0">
      <section id="pod-contact" aria-labelledby="pod-contact-heading" className="scroll-mt-36">
        <PageShell className="py-8 sm:py-10">
          <header className="mb-5 max-w-2xl">
            <h2 id="pod-contact-heading" className="text-xl font-bold tracking-tight text-oo-charcoal sm:text-2xl">
              Contact
            </h2>
            <p className="mt-2 text-sm text-oo-stone-gray">Reach the pod team with questions or event inquiries.</p>
          </header>

          <div className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm sm:p-6">
            <dl className="grid gap-5 sm:grid-cols-2">
              {phone && (
                <ContactRow label="Phone">
                  <a href={buildTelHref(phone)} className="font-medium underline-offset-2 hover:underline">
                    {phone}
                  </a>
                </ContactRow>
              )}
              {email && (
                <ContactRow label="Email">
                  <a href={buildMailtoHref(email)} className="font-medium underline-offset-2 hover:underline">
                    {email}
                  </a>
                </ContactRow>
              )}
              {website && (
                <ContactRow label="Website">
                  <a
                    href={website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    Visit website
                  </a>
                </ContactRow>
              )}
              {instagram && (
                <ContactRow label="Instagram">
                  <a
                    href={instagram.startsWith("http") ? instagram : `https://instagram.com/${formatInstagramHandle(instagram)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    @{formatInstagramHandle(instagram)}
                  </a>
                </ContactRow>
              )}
            </dl>

            <div className="mt-6 flex flex-wrap gap-3 border-t border-oo-light-stone pt-5">
              {email && (
                <ButtonLink href={buildMailtoHref(email)} variant="outline" size="sm">
                  Contact pod
                </ButtonLink>
              )}
              {website && (
                <ButtonLink href={website} variant="outline" size="sm" target="_blank" rel="noopener noreferrer">
                  Visit website
                </ButtonLink>
              )}
            </div>
          </div>
        </PageShell>
      </section>
    </PageBand>
  );
}

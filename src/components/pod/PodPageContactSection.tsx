import { PageShell } from "@/components/layout/page-shell";

export type PodContactInfo = {
  address: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  pickupInstructions: string | null;
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
      <dd className="mt-1 text-sm text-oo-charcoal">{children}</dd>
    </div>
  );
}

export function PodPageContactSection({ contact }: { contact: PodContactInfo }) {
  const address = contact.address?.trim();
  const email = contact.contactEmail?.trim();
  const phone = contact.contactPhone?.trim();
  const website = contact.websiteUrl?.trim();
  const instagram = contact.instagramUrl?.trim();
  const pickup = contact.pickupInstructions?.trim();

  const hasAny = Boolean(address || email || phone || website || instagram || pickup);
  if (!hasAny) return null;

  return (
    <section
      id="pod-contact"
      aria-labelledby="pod-contact-heading"
      className="scroll-mt-36 border-t border-oo-light-stone pt-8 sm:pt-10"
    >
      <header className="mb-5">
        <h2 id="pod-contact-heading" className="text-lg font-bold tracking-tight text-oo-charcoal sm:text-xl">
          Contact &amp; location
        </h2>
        <p className="mt-1 text-sm text-oo-stone-gray">
          Plan your visit or reach the pod team directly.
        </p>
      </header>

      <PageShell className="!px-0">
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {address && (
            <ContactRow label="Address">
              <span className="whitespace-pre-line">{address}</span>
            </ContactRow>
          )}
          {phone && (
            <ContactRow label="Phone">
              <a href={`tel:${phone.replace(/\s/g, "")}`} className="font-medium text-oo-charcoal underline-offset-2 hover:underline">
                {phone}
              </a>
            </ContactRow>
          )}
          {email && (
            <ContactRow label="Email">
              <a href={`mailto:${email}`} className="font-medium text-oo-charcoal underline-offset-2 hover:underline">
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
                className="font-medium text-oo-charcoal underline-offset-2 hover:underline"
              >
                Visit website
              </a>
            </ContactRow>
          )}
          {instagram && (
            <ContactRow label="Instagram">
              <a
                href={instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-oo-charcoal underline-offset-2 hover:underline"
              >
                @{instagram.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/$/, "")}
              </a>
            </ContactRow>
          )}
          {pickup && (
            <ContactRow label="Pickup">
              <span className="whitespace-pre-line leading-relaxed">{pickup}</span>
            </ContactRow>
          )}
        </dl>
      </PageShell>
    </section>
  );
}

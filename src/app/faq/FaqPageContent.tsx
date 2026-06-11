import { MarketingDocumentPage } from "@/components/marketing/MarketingDocumentPage";
import { ButtonLink } from "@/components/ui/button";
import { HOME_PRIMARY_CTA_LABEL, homePodOwnerMailtoHref } from "@/lib/home-marketing";
import { MARKETING_FAQ_ITEMS } from "@/lib/marketing-pages";

export function FaqPageContent() {
  return (
    <MarketingDocumentPage
      title="Frequently asked questions"
      intro={
        <p>
          Short answers about who Open Order is for, how guests order, and how pods get started.
        </p>
      }
    >
      <dl className="space-y-8">
        {MARKETING_FAQ_ITEMS.map((item) => (
          <div key={item.question} className="border-b border-oo-light-stone pb-8 last:border-0 last:pb-0">
            <dt className="text-lg font-bold tracking-tight text-oo-charcoal">{item.question}</dt>
            <dd className="mt-3 leading-relaxed text-oo-stone-gray">{item.answer}</dd>
          </div>
        ))}
      </dl>

      <section className="rounded-xl border border-oo-light-stone bg-oo-cream/60 px-6 py-8">
        <h2 className="text-lg font-bold tracking-tight text-oo-charcoal">Still have questions?</h2>
        <p className="mt-2 text-sm leading-relaxed text-oo-stone-gray">
          Pod owners can reach out directly — we&apos;re happy to talk through your setup.
        </p>
        <ButtonLink href={homePodOwnerMailtoHref()} className="mt-5 w-full sm:w-auto">
          {HOME_PRIMARY_CTA_LABEL}
        </ButtonLink>
      </section>
    </MarketingDocumentPage>
  );
}

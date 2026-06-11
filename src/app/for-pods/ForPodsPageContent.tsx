import { MarketingDocumentPage } from "@/components/marketing/MarketingDocumentPage";
import { ButtonLink } from "@/components/ui/button";
import { HOME_PRIMARY_CTA_LABEL, homePodOwnerMailtoHref } from "@/lib/home-marketing";

export function ForPodsPageContent() {
  return (
    <MarketingDocumentPage
      title="For food pod owners"
      intro={
        <p>
          Open Order helps your pod feel like one connected place — not a collection of separate ordering
          experiences competing for attention.
        </p>
      }
    >
      <section className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight text-oo-charcoal">The problem</h2>
        <p className="leading-relaxed text-oo-stone-gray">
          Food pods are social, but ordering is often fragmented. Separate lines, QR codes, checkouts, and
          pickup flows split groups up and create confusion for guests and staff.
        </p>
        <ul className="list-disc space-y-2 pl-5 leading-relaxed text-oo-stone-gray">
          <li>Groups arrive together but order separately</li>
          <li>Each vendor feels like its own island</li>
          <li>Pickup coordination becomes harder as pods grow</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight text-oo-charcoal">The Open Order solution</h2>
        <ul className="list-disc space-y-2 pl-5 leading-relaxed text-oo-stone-gray">
          <li>One QR code for the pod</li>
          <li>One ordering experience across vendors</li>
          <li>Multiple vendor menus in one flow</li>
          <li>One checkout for guests</li>
          <li>One order status and pickup path</li>
        </ul>
        <p className="leading-relaxed text-oo-stone-gray">
          Your pod keeps its character. Vendors keep their independence. Guests get a simpler way to order
          together.
        </p>
      </section>

      <section className="rounded-xl border border-oo-light-stone bg-oo-cream/60 px-6 py-8">
        <h2 className="text-xl font-bold tracking-tight text-oo-charcoal">Ready to talk?</h2>
        <p className="mt-3 leading-relaxed text-oo-stone-gray">
          Tell us about your pod and we’ll walk through fit, setup, and launch.
        </p>
        <ButtonLink
          href={homePodOwnerMailtoHref()}
          size="lg"
          className="mt-6 w-full sm:w-auto"
        >
          {HOME_PRIMARY_CTA_LABEL}
        </ButtonLink>
      </section>
    </MarketingDocumentPage>
  );
}

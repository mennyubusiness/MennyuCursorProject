import { PageBand, PageSection, PageShell } from "@/components/layout/page-shell";
import { ButtonLink } from "@/components/ui/button";
import { HomeQrCustomerFlow } from "@/components/home/HomeQrCustomerFlow";
import {
  HOME_CONTACT_SUBJECT,
  HOME_POD_OWNER_BENEFITS,
  HOME_POD_OWNER_HEADLINE,
  HOME_POD_OWNER_SUPPORTING,
  HOME_SECONDARY_CTA_LABEL,
  homePodOwnerMailtoHref,
} from "@/lib/home-marketing";

const PROBLEM_POINTS = [
  "Separate lines",
  "Separate QR codes or ordering systems",
  "Separate checkouts",
  "Separate pickup updates",
  "Groups split up instead of staying together",
] as const;

const SOLUTION_STEPS = [
  {
    step: "01",
    title: "Choose a pod",
    body: "Guests arrive at your food pod — usually by scanning your on-site QR code.",
  },
  {
    step: "02",
    title: "Order from multiple vendors",
    body: "One shared cart across vendors in the pod.",
  },
  {
    step: "03",
    title: "Check out once",
    body: "One payment, one pickup flow — no juggling separate orders.",
  },
  {
    step: "04",
    title: "Track every vendor order",
    body: "One order status page shows each vendor's progress in one place.",
  },
] as const;

const VENDOR_BENEFITS = [
  "Keep existing kitchen and POS workflows where applicable",
  "Receive clear vendor-specific orders",
  "Control availability",
  "Get paid by vendor order",
  "Join larger group orders without managing the whole group",
] as const;

const CUSTOMER_STEPS = [
  "Scan the pod QR code",
  "Browse all participating vendors",
  "Add items from multiple vendors",
  "Pay once",
  "Track every pickup from one order page",
] as const;

function BenefitList({
  items,
  className = "",
}: {
  items: readonly string[];
  className?: string;
}) {
  return (
    <ul className={`mt-6 space-y-3 ${className}`.trim()}>
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-sm leading-relaxed sm:text-base">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function HomeMarketingSections() {
  return (
    <>
      <PageSection className="!py-12 sm:!py-14">
        <PageShell>
          <div className="max-w-3xl">
            <h2 className="oo-section-title">
              Food pods are built for groups. The ordering experience is not.
            </h2>
            <p className="mt-4 text-lg text-oo-stone-gray">
              Today&apos;s patchwork of lines, codes, and checkouts pulls groups apart before the food
              even arrives.
            </p>
          </div>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PROBLEM_POINTS.map((point) => (
              <li key={point} className="oo-card-hover p-5 sm:p-6">
                <p className="text-sm font-semibold leading-snug text-oo-charcoal sm:text-base">{point}</p>
              </li>
            ))}
          </ul>
        </PageShell>
      </PageSection>

      <PageBand variant="dark">
        <PageSection className="!py-12 sm:!py-14">
          <PageShell>
            <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-16">
              <div>
                <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                  Open Order connects the pod experience.
                </h2>
                <p className="mt-4 text-base leading-relaxed text-oo-cream/60 sm:text-lg">
                  One connected ordering layer for the whole pod — built for groups, not fragmented
                  marketplaces.
                </p>
                <HomeQrCustomerFlow className="mt-6 lg:hidden" tone="dark" />
              </div>
              <ol className="space-y-5">
                {SOLUTION_STEPS.map((item) => (
                  <li
                    key={item.step}
                    className="flex gap-5 border-l-2 border-brand pl-5 transition hover:border-white"
                  >
                    <span className="text-xl font-black tabular-nums text-brand">{item.step}</span>
                    <div>
                      <h3 className="text-base font-bold text-white sm:text-lg">{item.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-oo-cream/60 sm:text-base">
                        {item.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </PageShell>
        </PageSection>
      </PageBand>

      <PageBand variant="muted">
        <PageSection className="!py-14 sm:!py-16">
          <PageShell>
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">For pod owners</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-oo-charcoal sm:text-4xl lg:text-5xl">
                {HOME_POD_OWNER_HEADLINE}
              </h2>
              <p className="mt-4 text-base leading-relaxed text-oo-stone-gray sm:text-lg">
                {HOME_POD_OWNER_SUPPORTING}
              </p>
            </div>
            <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_minmax(0,18rem)] lg:items-start">
              <article className="rounded-2xl border border-brand/20 bg-oo-warm-white p-6 shadow-[0_8px_32px_-14px_rgba(31,31,28,0.12)] sm:p-8">
                <BenefitList items={HOME_POD_OWNER_BENEFITS} className="text-oo-stone-gray" />
                <div className="mt-8">
                  <ButtonLink href={homePodOwnerMailtoHref()} size="lg">
                    Bring Open Order to your pod
                  </ButtonLink>
                </div>
              </article>
              <aside className="rounded-2xl border border-oo-light-stone bg-oo-cream/60 p-6">
                <p className="text-sm font-semibold text-oo-charcoal">Why pod owners choose Open Order</p>
                <p className="mt-2 text-sm leading-relaxed text-oo-stone-gray">
                  One QR code, one checkout, and one status flow — without turning your pod into a generic
                  delivery marketplace.
                </p>
              </aside>
            </div>
          </PageShell>
        </PageSection>
      </PageBand>

      <PageSection className="!py-10 sm:!py-12">
        <PageShell>
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
            <article className="rounded-xl border border-oo-light-stone bg-oo-cream/40 p-6 sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">For vendors</p>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-oo-charcoal">
                More orders, less disruption.
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-oo-stone-gray">
                Vendors keep their workflow where applicable, receive clear orders, and participate in
                group carts without running the whole group.
              </p>
              <BenefitList items={VENDOR_BENEFITS} className="text-oo-stone-gray" />
            </article>

            <article className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-6 sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">For guests</p>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-oo-charcoal">
                Order together. Eat together.
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-oo-stone-gray">
                Most guests scan the pod QR code on-site. Explore is a fallback when you need to find a
                pod without a code.
              </p>
              <ol className="mt-5 space-y-2">
                {CUSTOMER_STEPS.map((step, index) => (
                  <li key={step} className="flex gap-3 text-sm text-oo-stone-gray">
                    <span className="font-bold tabular-nums text-brand">{index + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-5">
                <ButtonLink href="/explore" variant="secondary" size="sm">
                  {HOME_SECONDARY_CTA_LABEL}
                </ButtonLink>
              </p>
            </article>
          </div>
        </PageShell>
      </PageSection>

      <PageBand variant="dark">
        <PageSection className="!py-12 sm:!py-14">
          <PageShell className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                Ready to connect your food pod?
              </h2>
              <p className="mt-4 text-base leading-relaxed text-oo-cream/60 sm:text-lg">
                Talk with Open Order about bringing one checkout, one cart, and one status flow to your
                pod.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <ButtonLink href={homePodOwnerMailtoHref(HOME_CONTACT_SUBJECT)} size="lg" className="w-full sm:w-auto">
                Contact Open Order
              </ButtonLink>
              <ButtonLink
                href="/explore"
                variant="secondary"
                size="lg"
                className="w-full border-oo-cream/40 text-oo-warm-white hover:border-oo-warm-white hover:bg-oo-warm-white hover:text-oo-charcoal sm:w-auto"
              >
                {HOME_SECONDARY_CTA_LABEL}
              </ButtonLink>
            </div>
          </PageShell>
        </PageSection>
      </PageBand>
    </>
  );
}

import { PageBand, PageSection, PageShell } from "@/components/layout/page-shell";
import { ButtonLink } from "@/components/ui/button";
import { homePodOwnerMailtoHref, HOME_CONTACT_SUBJECT } from "@/lib/home-marketing";

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
    body: "One shared cart across every kitchen in the pod.",
  },
  {
    step: "03",
    title: "Check out once",
    body: "One payment, one pickup flow — no juggling separate orders.",
  },
  {
    step: "04",
    title: "Track every vendor order",
    body: "One order status page shows progress for the whole group.",
  },
] as const;

const POD_OWNER_BENEFITS = [
  "Make the pod feel unified",
  "Improve the guest experience",
  "Help groups order together",
  "Support vendors without forcing a POS replacement",
  "Give guests a better reason to stay, order, and return",
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
  "Track pickup from one order page",
] as const;

function BenefitList({ items }: { items: readonly string[] }) {
  return (
    <ul className="mt-6 space-y-3">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-sm leading-relaxed text-oo-stone-gray sm:text-base">
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
      <PageSection className="!py-14 sm:!py-16">
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
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PROBLEM_POINTS.map((point) => (
              <li key={point} className="oo-card-hover p-5 sm:p-6">
                <p className="text-sm font-semibold leading-snug text-oo-charcoal sm:text-base">{point}</p>
              </li>
            ))}
          </ul>
        </PageShell>
      </PageSection>

      <PageBand variant="dark">
        <PageSection className="!py-14 sm:!py-16">
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
              </div>
              <ol className="space-y-6">
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

      <PageSection className="!py-14 sm:!py-16">
        <PageShell>
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">For pod owners</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-oo-charcoal sm:text-4xl">
                Turn your food pod into one connected ordering experience.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-oo-stone-gray sm:text-lg">
                Open Order is infrastructure for the pod — not another consumer marketplace fighting for
                attention.
              </p>
              <BenefitList items={POD_OWNER_BENEFITS} />
              <div className="mt-8">
                <ButtonLink href={homePodOwnerMailtoHref()} size="lg">
                  Bring Open Order to your pod
                </ButtonLink>
              </div>
            </div>
            <article className="rounded-2xl border border-oo-light-stone bg-oo-cream/70 p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">For vendors</p>
              <h3 className="mt-3 text-2xl font-black tracking-tight text-oo-charcoal sm:text-3xl">
                More orders, less disruption.
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-oo-stone-gray sm:text-base">
                Vendors stay in their lane. Open Order routes clear orders without replacing how you
                already run the kitchen.
              </p>
              <BenefitList items={VENDOR_BENEFITS} />
            </article>
          </div>
        </PageShell>
      </PageSection>

      <PageBand variant="muted">
        <PageSection className="!py-12 sm:!py-14">
          <PageShell>
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">For guests</p>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-oo-charcoal sm:text-3xl">
                Order together. Eat together.
              </h2>
              <p className="mt-3 text-base text-oo-stone-gray">
                Most guests start by scanning the QR code at the pod. Explore is there when you need a
                fallback.
              </p>
            </div>
            <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {CUSTOMER_STEPS.map((step, index) => (
                <li
                  key={step}
                  className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-4 shadow-sm"
                >
                  <span className="text-xs font-bold tabular-nums text-brand">{index + 1}</span>
                  <p className="mt-2 text-sm font-medium leading-snug text-oo-charcoal">{step}</p>
                </li>
              ))}
            </ol>
            <p className="mt-6">
              <ButtonLink href="/explore" variant="secondary" size="sm">
                Explore participating pods
              </ButtonLink>
            </p>
          </PageShell>
        </PageSection>
      </PageBand>

      <PageBand variant="dark">
        <PageSection className="!py-14 sm:!py-16">
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
                Explore participating pods
              </ButtonLink>
            </div>
          </PageShell>
        </PageSection>
      </PageBand>
    </>
  );
}

import Link from "next/link";
import { JoinGroupOrderByCodeForm } from "@/app/cart/JoinGroupOrderByCodeForm";
import { PageShell } from "@/components/layout/page-shell";
import { HomeRecentOrdersSection } from "@/components/home/HomeRecentOrdersSection";
import { CustomerRetentionStrip } from "@/components/retention/CustomerRetentionStrip";
import { cn } from "@/lib/cn";

type Props = {
  customerAccountId: string | null;
};

const panelInnerClass =
  "relative flex flex-col rounded-xl border border-oo-light-stone bg-oo-cream/60 p-5 sm:p-6";

/**
 * Cream band under the hero: one warm-white module with group order (left) + shortcuts (right).
 */
export function HomeJoinGroupSection({ customerAccountId }: Props) {
  return (
    <section
      className="relative overflow-hidden border-y border-oo-light-stone bg-oo-cream"
      aria-label="Group orders and your shortcuts"
    >
      <div
        className="pointer-events-none absolute left-1/2 top-8 h-48 w-[min(100%,28rem)] -translate-x-1/2 rounded-full bg-brand/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-12 bottom-4 h-32 w-32 rounded-full border border-oo-light-stone/60 opacity-50"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(231, 224, 214, 0.5) 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
        aria-hidden
      />

      <PageShell className="relative py-10 sm:py-12 lg:py-14">
        <div className="overflow-hidden rounded-2xl border border-oo-light-stone bg-oo-warm-white shadow-[0_8px_32px_-14px_rgba(31,31,28,0.14)]">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-stretch lg:divide-x lg:divide-oo-light-stone">
            <div className="flex min-w-0 flex-col p-6 sm:p-7 lg:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Group order</p>
              <h2
                id="home-join-group-heading"
                className="mt-2 text-xl font-bold tracking-tight text-oo-charcoal sm:text-2xl"
              >
                Ordering with friends?
              </h2>
              <p className="mt-2 max-w-md text-base leading-relaxed text-oo-stone-gray">
                Enter a 6-digit group order code to add your items to a shared checkout.
              </p>
              <div className={cn(panelInnerClass, "mt-5")}>
                <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-xl bg-brand" aria-hidden />
                <span className="mb-4 inline-flex w-fit items-center rounded-full border border-oo-light-stone bg-oo-warm-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-oo-stone-gray">
                  Shared checkout
                </span>
                <JoinGroupOrderByCodeForm />
              </div>
            </div>

            <aside
              className="flex min-w-0 flex-col border-t border-oo-light-stone p-6 sm:p-7 lg:h-full lg:border-t-0 lg:p-8"
              aria-label="Recent activity"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Your shortcuts</p>
              <div className={cn(panelInnerClass, "mt-5 min-h-[12.5rem] flex-1 lg:min-h-[14rem]")}>
                <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-xl bg-brand" aria-hidden />
                <CustomerRetentionStrip
                  heading="Pick up where you left off"
                  helperText="Jump back into a recent pod or vendor."
                  showEmptyPlaceholder
                  embedded
                />
              </div>
              <HomeRecentOrdersSection
                customerAccountId={customerAccountId}
                variant="rail"
                embedded
              />
              <p className="mt-5 text-center text-sm text-oo-stone-gray lg:text-left">
                <Link
                  href="/explore"
                  className="font-semibold text-brand underline-offset-4 transition hover:text-[#EA580C] hover:underline"
                >
                  Explore food pods →
                </Link>
              </p>
            </aside>
          </div>
        </div>
      </PageShell>
    </section>
  );
}

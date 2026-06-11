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
 * Signed-in customer utilities — separated from the public marketing homepage.
 */
export function HomeJoinGroupSection({ customerAccountId }: Props) {
  return (
    <section
      className="border-t border-oo-light-stone bg-oo-cream/50"
      aria-labelledby="home-signed-in-heading"
    >
      <PageShell className="py-10 sm:py-12">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Signed in</p>
          <h2
            id="home-signed-in-heading"
            className="mt-2 text-2xl font-black tracking-tight text-oo-charcoal sm:text-3xl"
          >
            Your orders and group carts
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-oo-stone-gray sm:text-base">
            Shortcuts for returning guests. New visitors should scan their pod&apos;s QR code to start
            ordering.
          </p>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border border-oo-light-stone bg-oo-warm-white shadow-[0_8px_32px_-14px_rgba(31,31,28,0.12)]">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-stretch lg:divide-x lg:divide-oo-light-stone">
            <div className="flex min-w-0 flex-col p-6 sm:p-7 lg:p-8">
              <h3 className="text-lg font-bold text-oo-charcoal">Join a group order</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-oo-stone-gray">
                Enter a 6-digit code to add your items to a shared checkout.
              </p>
              <div className={cn(panelInnerClass, "mt-5")}>
                <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-xl bg-brand" aria-hidden />
                <JoinGroupOrderByCodeForm />
              </div>
            </div>

            <aside
              className="flex min-w-0 flex-col border-t border-oo-light-stone p-6 sm:p-7 lg:border-t-0 lg:p-8"
              aria-label="Recent activity"
            >
              <h3 className="text-lg font-bold text-oo-charcoal">Recent activity</h3>
              <div className={cn(panelInnerClass, "mt-5 min-h-[12rem] flex-1")}>
                <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-xl bg-brand" aria-hidden />
                <CustomerRetentionStrip
                  heading="Pick up where you left off"
                  helperText="Return to a recent pod or vendor."
                  showEmptyPlaceholder
                  embedded
                />
              </div>
              <HomeRecentOrdersSection
                customerAccountId={customerAccountId}
                variant="rail"
                embedded
              />
              <p className="mt-5 text-sm text-oo-stone-gray">
                Manage phone and order history in{" "}
                <Link href="/account" className="font-semibold text-brand hover:underline">
                  Account
                </Link>
                .
              </p>
            </aside>
          </div>
        </div>
      </PageShell>
    </section>
  );
}

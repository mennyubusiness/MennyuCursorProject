import Link from "next/link";
import { getRecentCompletedOrdersForPhone } from "@/services/order.service";
import { ReorderButton } from "@/components/orders/ReorderButton";

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function vendorSummary(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length <= 2) return names.join(" · ");
  return `${names.slice(0, 2).join(" · ")} +${names.length - 2}`;
}

function PodInitial({ name }: { name: string }) {
  const letter = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-oo-cream text-sm font-bold text-oo-charcoal ring-1 ring-oo-light-stone"
      aria-hidden
    >
      {letter}
    </span>
  );
}

type Props = {
  customerPhone: string | null;
  variant?: "default" | "rail";
  /** Nested in homepage module — no standalone card chrome. */
  embedded?: boolean;
};

export async function HomeRecentOrdersSection({
  customerPhone,
  variant = "default",
  embedded = false,
}: Props) {
  const phone = customerPhone?.trim();
  if (!phone) return null;

  const recent = await getRecentCompletedOrdersForPhone(phone, 3);
  if (recent.length === 0) return null;

  if (variant === "rail") {
    return (
      <section
        className={
          embedded
            ? "mt-5 border-t border-oo-light-stone pt-5"
            : "rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-md sm:p-6"
        }
        aria-labelledby="home-recent-orders-heading"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="home-recent-orders-heading" className="text-lg font-bold tracking-tight text-oo-charcoal">
              Order again
            </h2>
            <p className="mt-1 text-sm text-oo-stone-gray">Rebuild a cart from a recent pickup.</p>
          </div>
          <Link
            href="/orders"
            className="shrink-0 text-sm font-semibold text-brand underline-offset-4 transition hover:text-[#EA580C] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            All →
          </Link>
        </div>
        <ul className="mt-4 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {recent.map((o) => (
            <li key={o.id} className="w-[min(100%,17rem)] shrink-0">
              <article className="oo-card-hover flex h-full flex-col gap-3 p-4">
                <div className="flex gap-3">
                  <PodInitial name={o.podName} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-oo-charcoal">{o.podName}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-oo-stone-gray">
                      Completed order
                    </p>
                    {o.vendorNames.length > 0 && (
                      <p
                        className="mt-1 truncate text-xs text-oo-stone-gray"
                        title={vendorSummary(o.vendorNames)}
                      >
                        {vendorSummary(o.vendorNames)}
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-oo-stone-gray">
                  {formatDate(o.createdAt)} · ${(o.totalCents / 100).toFixed(2)}
                </p>
                <ReorderButton orderId={o.id} />
              </article>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section aria-labelledby="home-recent-orders-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="home-recent-orders-heading" className="oo-section-title">
            Order again
          </h2>
          <p className="mt-2 max-w-xl text-base text-oo-stone-gray">
            Your last completed orders — rebuild your cart when you&apos;re ready.
          </p>
        </div>
        <Link
          href="/orders"
          className="text-sm font-semibold text-brand underline-offset-4 transition hover:text-[#EA580C] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          All orders →
        </Link>
      </div>
      <ul className="mt-8 grid gap-4 lg:grid-cols-3 lg:gap-6">
        {recent.map((o) => (
          <li key={o.id} className="oo-card-hover flex flex-col gap-4 p-5">
            <div className="min-w-0 flex-1">
              <p className="font-bold text-oo-charcoal">{o.podName}</p>
              {o.vendorNames.length > 0 && (
                <p className="mt-1 truncate text-sm text-oo-stone-gray" title={vendorSummary(o.vendorNames)}>
                  {vendorSummary(o.vendorNames)}
                </p>
              )}
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-oo-stone-gray">
                {formatDate(o.createdAt)} · ${(o.totalCents / 100).toFixed(2)}
              </p>
            </div>
            <ReorderButton orderId={o.id} />
          </li>
        ))}
      </ul>
    </section>
  );
}

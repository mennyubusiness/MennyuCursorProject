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

export async function HomeRecentOrdersSection({ customerPhone }: { customerPhone: string | null }) {
  const phone = customerPhone?.trim();
  if (!phone) return null;

  const recent = await getRecentCompletedOrdersForPhone(phone, 3);
  if (recent.length === 0) return null;

  return (
    <section aria-labelledby="home-recent-orders-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="home-recent-orders-heading" className="oo-section-title">
            Order again
          </h2>
          <p className="mt-2 max-w-xl text-base text-zinc-600">
            Your last completed orders — rebuild your cart when you&apos;re ready.
          </p>
        </div>
        <Link
          href="/orders"
          className="text-sm font-semibold text-brand underline-offset-4 transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
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
                <p className="mt-1 truncate text-sm text-zinc-600" title={vendorSummary(o.vendorNames)}>
                  {vendorSummary(o.vendorNames)}
                </p>
              )}
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
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

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
    <section
      className="rounded-2xl border border-stone-200/90 bg-gradient-to-b from-white to-stone-50/90 p-6 shadow-sm sm:p-8"
      aria-labelledby="home-recent-orders-heading"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="home-recent-orders-heading" className="text-xl font-semibold tracking-tight text-stone-900">
            Order again
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            Your last completed orders — rebuild your cart when you&apos;re ready. Unavailable items stay
            out of the cart.
          </p>
        </div>
        <Link
          href="/orders"
          className="text-sm font-semibold text-mennyu-primary underline-offset-4 transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mennyu-primary"
        >
          All orders
        </Link>
      </div>
      <ul className="mt-6 space-y-4">
        {recent.map((o) => (
          <li
            key={o.id}
            className="flex flex-col gap-4 rounded-xl border border-stone-200/80 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-stone-900">{o.podName}</p>
              {o.vendorNames.length > 0 && (
                <p className="mt-0.5 truncate text-sm text-stone-600" title={vendorSummary(o.vendorNames)}>
                  {vendorSummary(o.vendorNames)}
                </p>
              )}
              <p className="mt-2 text-xs text-stone-500">
                {formatDate(o.createdAt)} · ${(o.totalCents / 100).toFixed(2)}
              </p>
            </div>
            <div className="shrink-0 sm:pl-2">
              <ReorderButton orderId={o.id} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

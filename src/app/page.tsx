import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeRecentOrdersSection } from "@/components/home/HomeRecentOrdersSection";
import { CustomerRetentionStrip } from "@/components/retention/CustomerRetentionStrip";
import { resolveCustomerPhoneForSession } from "@/lib/customer-phone-resolution";

export default async function HomePage() {
  const featuredPodsRaw = await prisma.pod.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    take: 5,
    include: {
      _count: {
        select: {
          vendors: { where: { isActive: true } },
        },
      },
    },
  });

  const featuredPods = featuredPodsRaw.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    imageUrl: p.imageUrl,
    vendorCount: p._count.vendors,
  }));

  const headersList = await headers();
  const session = await auth();
  const customerPhone = await resolveCustomerPhoneForSession(headersList, session?.user?.id ?? null);

  return (
    <div className="mx-auto max-w-3xl space-y-14 py-10 sm:space-y-16 sm:py-14">
      <HomeHero featuredPods={featuredPods} />

      <HomeRecentOrdersSection customerPhone={customerPhone} />

      <CustomerRetentionStrip />

      <section className="rounded-2xl border border-stone-200/90 bg-mennyu-muted/80 p-8 shadow-sm">
        <h2 className="text-xl font-semibold tracking-tight text-stone-900">How it works</h2>
        <ul className="mt-6 space-y-5 text-stone-700">
          <li className="flex gap-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mennyu-primary text-sm font-bold text-black shadow-sm">
              1
            </span>
            <span className="leading-relaxed">
              <strong className="text-stone-900">Browse pods</strong> — Find a food pod near you and see
              its vendors.
            </span>
          </li>
          <li className="flex gap-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mennyu-primary text-sm font-bold text-black shadow-sm">
              2
            </span>
            <span className="leading-relaxed">
              <strong className="text-stone-900">Order from multiple vendors</strong> — Add items from
              different vendors into one cart.
            </span>
          </li>
          <li className="flex gap-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mennyu-primary text-sm font-bold text-black shadow-sm">
              3
            </span>
            <span className="leading-relaxed">
              <strong className="text-stone-900">One pickup</strong> — Pay once and pick up with a single
              code.
            </span>
          </li>
        </ul>
      </section>

      <section className="rounded-2xl border border-stone-200/90 bg-white p-8 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.08)] sm:p-10">
        <h2 className="text-center text-2xl font-bold tracking-tight text-stone-900">
          Built for everyone at the pod
        </h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-3 sm:gap-6">
          <article className="rounded-2xl border border-stone-200/90 bg-stone-50/80 p-6 transition duration-200 hover:border-mennyu-primary/30 hover:shadow-md">
            <h3 className="text-lg font-semibold text-stone-900">Customers</h3>
            <p className="mt-3 text-sm leading-relaxed text-stone-600">
              Order from multiple vendors at once, skip the lines, and pick everything up in one trip.
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200/90 bg-stone-50/80 p-6 transition duration-200 hover:border-mennyu-primary/30 hover:shadow-md">
            <h3 className="text-lg font-semibold text-stone-900">Vendors</h3>
            <p className="mt-3 text-sm leading-relaxed text-stone-600">
              Reach more customers, streamline orders, and stay focused on making great food.
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200/90 bg-stone-50/80 p-6 transition duration-200 hover:border-mennyu-primary/30 hover:shadow-md">
            <h3 className="text-lg font-semibold text-stone-900">Pod Owners</h3>
            <p className="mt-3 text-sm leading-relaxed text-stone-600">
              Manage your pod, support your vendors, and create a better experience across every order.
            </p>
          </article>
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200/80 bg-gradient-to-b from-mennyu-muted/60 to-stone-50/90 p-8 text-center shadow-sm sm:p-10">
        <h2 className="text-2xl font-bold tracking-tight text-stone-900">Run your pod on Mennyu</h2>
        <p className="mx-auto mt-3 max-w-lg text-stone-600">
          Bring your vendors together, streamline orders, and create a better customer experience.
        </p>
        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-4">
          <Link
            href="/register"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-mennyu-primary px-7 py-3 text-base font-semibold text-black shadow-sm transition duration-200 hover:bg-mennyu-secondary hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mennyu-primary active:scale-[0.98]"
          >
            List your pod
          </Link>
          <Link
            href="/register"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border-2 border-stone-300 bg-white px-7 py-3 text-base font-semibold text-stone-800 transition hover:border-stone-400 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-400 active:scale-[0.98]"
          >
            Join as a vendor
          </Link>
        </div>
      </section>
    </div>
  );
}

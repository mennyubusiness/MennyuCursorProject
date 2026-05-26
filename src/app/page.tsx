import { headers } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { HomeHero } from "@/components/home/HomeHero";
import { JoinGroupOrderByCodeForm } from "@/app/cart/JoinGroupOrderByCodeForm";
import { HomeRecentOrdersSection } from "@/components/home/HomeRecentOrdersSection";
import { CustomerRetentionStrip } from "@/components/retention/CustomerRetentionStrip";
import { resolveCustomerPhoneForSession } from "@/lib/customer-phone-resolution";
import { PageBand, PageSection, PageShell } from "@/components/layout/page-shell";
import { ButtonLink } from "@/components/ui/button";

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
    <div className="w-full">
      <HomeHero featuredPods={featuredPods} />

      <PageSection className="!py-12 sm:!py-16">
        <PageShell>
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-start lg:gap-16">
            <div>
              <h2 className="oo-section-title">Join a group order</h2>
              <p className="mt-3 max-w-md text-base leading-relaxed text-zinc-600">
                Have a 6-digit code? Enter it to add items to a shared cart with friends.
              </p>
            </div>
            <div className="oo-card p-6 sm:p-8">
              <JoinGroupOrderByCodeForm />
            </div>
          </div>
        </PageShell>
      </PageSection>

      <PageShell className="space-y-16 pb-20 sm:space-y-20 sm:pb-28">
        <HomeRecentOrdersSection customerPhone={customerPhone} />
        <CustomerRetentionStrip />
      </PageShell>

      <PageBand variant="dark">
        <PageSection className="!py-16 sm:!py-20">
          <PageShell>
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
              <div>
                <h2 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
                  How it works
                </h2>
                <p className="mt-4 max-w-md text-lg text-zinc-500">
                  Three steps from browse to pickup — no friction, no duplicate payments.
                </p>
              </div>
              <ol className="space-y-8">
                {[
                  {
                    step: "01",
                    title: "Browse pods",
                    body: "Find a food pod near you and see every vendor in one place.",
                  },
                  {
                    step: "02",
                    title: "One cart, many vendors",
                    body: "Add items from different vendors — checkout stays unified.",
                  },
                  {
                    step: "03",
                    title: "Single pickup",
                    body: "Pay once. Pick up everything with one code, one trip.",
                  },
                ].map((item) => (
                  <li
                    key={item.step}
                    className="flex gap-6 border-l-2 border-brand pl-6 transition hover:border-white"
                  >
                    <span className="text-2xl font-black tabular-nums text-brand">{item.step}</span>
                    <div>
                      <h3 className="text-lg font-bold text-white">{item.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-500 sm:text-base">
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

      <PageSection>
        <PageShell>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="oo-section-title">Built for the whole pod</h2>
              <p className="mt-3 max-w-2xl text-lg text-zinc-600">
                Customers, vendors, and pod operators — one platform, one operational layer.
              </p>
            </div>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3 lg:gap-8">
            {[
              {
                title: "Customers",
                body: "Order from multiple vendors at once, skip lines, pick up in one trip.",
              },
              {
                title: "Vendors",
                body: "Reach more customers, streamline orders, stay focused on the food.",
              },
              {
                title: "Pod owners",
                body: "Manage vendors, run operations, and scale the marketplace.",
              },
            ].map((card) => (
              <article key={card.title} className="oo-card-hover p-8">
                <h3 className="text-xl font-bold tracking-tight text-black">{card.title}</h3>
                <p className="mt-4 text-sm leading-relaxed text-zinc-600 sm:text-base">{card.body}</p>
              </article>
            ))}
          </div>
        </PageShell>
      </PageSection>

      <PageBand variant="muted">
        <PageSection className="!py-16 sm:!py-20">
          <PageShell className="flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-4xl font-black tracking-tight text-black sm:text-5xl">
                Run your pod on Open Order
              </h2>
              <p className="mt-4 text-lg text-zinc-600">
                Bring vendors together, streamline orders, and deliver a premium pickup experience.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <ButtonLink href="/register" size="lg" className="w-full sm:w-auto">
                List your pod
              </ButtonLink>
              <ButtonLink href="/register" variant="secondary" size="lg" className="w-full sm:w-auto">
                Join as a vendor
              </ButtonLink>
            </div>
          </PageShell>
        </PageSection>
      </PageBand>
    </div>
  );
}

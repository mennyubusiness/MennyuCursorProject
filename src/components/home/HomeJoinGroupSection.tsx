import { JoinGroupOrderByCodeForm } from "@/app/cart/JoinGroupOrderByCodeForm";
import { PageShell } from "@/components/layout/page-shell";

/**
 * Cream band directly under the hero: group-order copy + form only.
 */
export function HomeJoinGroupSection() {
  return (
    <section
      className="border-y border-oo-light-stone bg-oo-cream"
      aria-labelledby="home-join-group-heading"
    >
      <PageShell className="flex flex-col justify-center py-12 sm:py-16 lg:py-20">
        <h2 id="home-join-group-heading" className="oo-section-title max-w-lg">
          Join a group order
        </h2>
        <p className="mt-3 max-w-md text-base leading-relaxed text-oo-stone-gray">
          Have a 6-digit code? Enter it to add items to a shared cart with friends.
        </p>
        <div className="oo-card mt-8 max-w-lg p-6 sm:p-8">
          <JoinGroupOrderByCodeForm />
        </div>
      </PageShell>
    </section>
  );
}

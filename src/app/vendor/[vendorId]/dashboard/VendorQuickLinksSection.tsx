import Link from "next/link";

const QUICK_LINKS = [
  { href: "menu", label: "Manage menu availability", description: "See what customers can order" },
  { href: "hours", label: "Edit hours", description: "Pause, resume, and store hours" },
  { href: "orders", label: "View order history", description: "Active board and past orders" },
  { href: "payouts", label: "View payouts", description: "Stripe status and transfers" },
  { href: "setup", label: "Complete setup", description: "Readiness checklist" },
  { href: "settings?section=profile", label: "Update business profile", description: "Name, logo, and contact" },
] as const;

export function VendorQuickLinksSection({ vendorId }: { vendorId: string }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-oo-charcoal">Quick links</h2>
        <p className="mt-1 text-sm text-oo-stone-gray">Common tasks without digging through every page.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.href}
            href={`/vendor/${vendorId}/${link.href}`}
            className="rounded-xl border border-oo-light-stone bg-oo-warm-white px-4 py-3 shadow-sm transition hover:border-stone-300 hover:shadow"
          >
            <p className="font-medium text-oo-charcoal">{link.label}</p>
            <p className="mt-1 text-xs text-oo-stone-gray">{link.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

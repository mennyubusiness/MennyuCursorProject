import Link from "next/link";

const QUICK_LINKS = [
  { href: "menu", label: "Manage menu availability", description: "See what customers can order" },
  { href: "hours", label: "Edit hours", description: "Set when customers can place orders" },
  { href: "orders", label: "View order history", description: "Active board and past orders" },
  { href: "payouts", label: "View payouts", description: "Stripe status and transfers" },
  { href: "setup", label: "Complete setup", description: "Readiness checklist" },
  { href: "settings", label: "Vendor profile", description: "Public name, logo, and description" },
] as const;

/** Menu-only replacements: same destinations, browse-oriented descriptions where ordering is implied. */
const MENU_ONLY_LINK_OVERRIDES: Record<string, { label: string; description: string }> = {
  menu: { label: "Manage menu", description: "What customers see on your menu" },
  hours: { label: "Edit hours", description: "Hours shown on your public page" },
};

/** Commerce-only quick links, dropped in menu-only mode. */
const MENU_ONLY_HIDDEN_LINKS = new Set(["payouts"]);

export function VendorQuickLinksSection({
  vendorId,
  menuOnly = false,
}: {
  vendorId: string;
  menuOnly?: boolean;
}) {
  const links = QUICK_LINKS.filter(
    (link) => !menuOnly || !MENU_ONLY_HIDDEN_LINKS.has(link.href)
  ).map((link) => {
    const override = menuOnly ? MENU_ONLY_LINK_OVERRIDES[link.href] : undefined;
    return override ? { ...link, ...override } : link;
  });

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-oo-charcoal">Quick links</h2>
        <p className="mt-1 text-sm text-oo-stone-gray">Common tasks without digging through every page.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((link) => (
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

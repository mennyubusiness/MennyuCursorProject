import Link from "next/link";
import { buildPodCustomerPath } from "@/lib/customer-public-url";

export const POD_DASHBOARD_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "vendors", label: "Vendors" },
  { id: "promote", label: "Promote" },
  { id: "activity", label: "Activity" },
  { id: "setup", label: "Setup" },
] as const;

type PodDashboardSidebarProps = {
  podId: string;
  podSlug: string;
  podName: string;
  isActive: boolean;
  orderableVendorCount: number;
};

function SectionNavLinks({ compact }: { compact: boolean }) {
  const linkClass = compact
    ? "shrink-0 rounded-full border border-oo-light-stone bg-oo-warm-white px-3 py-1.5 text-xs font-semibold text-oo-charcoal transition-colors hover:border-oo-stone-gray/50 hover:bg-oo-cream"
    : "block rounded-lg px-3 py-2 text-sm font-medium text-oo-stone-gray transition-colors hover:bg-oo-cream hover:text-oo-charcoal";

  return (
    <>
      {POD_DASHBOARD_SECTIONS.map(({ id, label }) => (
        <a key={id} href={`#${id}`} className={linkClass}>
          {label}
        </a>
      ))}
    </>
  );
}

export function PodDashboardSidebar({
  podId,
  podSlug,
  podName,
  isActive,
  orderableVendorCount,
}: PodDashboardSidebarProps) {
  const publicPodPath = buildPodCustomerPath(podSlug);
  const statusLabel = isActive ? "Active" : "Inactive";
  const statusClass = isActive
    ? "bg-emerald-100 text-emerald-900"
    : "bg-amber-100 text-amber-900";

  return (
    <>
      <div
        className="sticky top-[7.25rem] z-20 -mx-4 border-b border-oo-light-stone bg-oo-cream/95 px-4 py-2 backdrop-blur-md supports-[backdrop-filter]:bg-oo-cream/90 lg:hidden"
        role="navigation"
        aria-label="Dashboard sections"
      >
        <div className="flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <SectionNavLinks compact />
        </div>
      </div>

      <aside
        className="hidden w-60 shrink-0 lg:block"
        aria-label="Pod dashboard"
      >
        <div className="sticky top-24 space-y-5 pb-8">
          <div className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-4">
            <p className="break-words text-base font-semibold text-oo-charcoal">{podName}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass}`}>
                {statusLabel}
              </span>
              <span className="text-xs text-oo-stone-gray">
                {orderableVendorCount} orderable vendor{orderableVendorCount === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          <nav aria-label="Dashboard sections">
            <p className="px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-oo-stone-gray">
              Sections
            </p>
            <div className="mt-2 space-y-0.5">
              <SectionNavLinks compact={false} />
            </div>
          </nav>

          <div className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-oo-stone-gray">
              Quick links
            </p>
            <ul className="mt-2 space-y-2 text-sm">
              <li>
                <Link
                  href={publicPodPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-oo-charcoal hover:underline"
                >
                  View public pod page
                </Link>
              </li>
              <li>
                <Link
                  href={`/pod/${podId}/settings#ordering-qr`}
                  className="font-medium text-oo-charcoal hover:underline"
                >
                  QR &amp; signage
                </Link>
              </li>
              <li>
                <Link
                  href={`/pod/${podId}/settings`}
                  className="font-medium text-oo-charcoal hover:underline"
                >
                  Edit pod profile
                </Link>
                <p className="mt-0.5 text-xs text-oo-stone-gray">
                  Brand, location, and public page details
                </p>
              </li>
            </ul>
          </div>
        </div>
      </aside>
    </>
  );
}

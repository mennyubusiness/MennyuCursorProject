import Link from "next/link";
import { VendorLogo } from "@/components/images/VendorLogo";
import { FavoriteVendorButton } from "@/components/retention/FavoriteVendorButton";
import { PageShell } from "@/components/layout/page-shell";
import { VendorHoursDisclosure } from "@/components/vendor/VendorHoursDisclosure";
import type { VendorHoursDisplayModel } from "@/lib/vendor-hours-display";
import type { VendorAvailabilityStatus } from "@/lib/vendor-availability";
import { MENU_ONLY_BADGE } from "@/lib/vendor-ordering-mode";
import { cn } from "@/lib/cn";

function VendorStatusBadge({
  status,
  menuOnly,
}: {
  status: VendorAvailabilityStatus;
  menuOnly?: boolean;
}) {
  /** Menu-only is intentional, so it reads as a neutral suffix on the open/closed status. */
  const menuOnlySuffix = menuOnly ? ` · ${MENU_ONLY_BADGE}` : "";

  if (status === "open") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
        Open{menuOnlySuffix}
      </span>
    );
  }
  const label =
    status === "closed"
      ? "Closed"
      : status === "mennyu_paused"
        ? "Not accepting orders"
        : "Unavailable";

  if (menuOnly) {
    return (
      <span className="text-[11px] font-semibold uppercase tracking-wide text-oo-stone-gray">
        Closed{menuOnlySuffix}
      </span>
    );
  }

  return (
    <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">
      {label}
    </span>
  );
}

import { buildPodCustomerPath } from "@/lib/customer-public-url";

type VendorMenuHeroProps = {
  podId: string;
  podSlug: string;
  podName: string;
  podAccentColor: string | null;
  vendorId: string;
  vendorName: string;
  vendorDescription: string | null;
  vendorImageUrl: string | null;
  vendorAccentColor: string | null;
  cuisineCategory: string | null;
  availabilityStatus: VendorAvailabilityStatus;
  /** Durable menu-only mode: shown once here, never repeated per menu item. */
  menuOnly?: boolean;
  bannerLine: string | null;
  hoursDisplay: VendorHoursDisplayModel;
};

export function VendorMenuHero({
  podId,
  podSlug,
  podName,
  podAccentColor,
  vendorId,
  vendorName,
  vendorDescription,
  vendorImageUrl,
  vendorAccentColor,
  cuisineCategory,
  availabilityStatus,
  menuOnly,
  bannerLine,
  hoursDisplay,
}: VendorMenuHeroProps) {
  const trimmedPodName = podName?.trim();
  const backLabel = trimmedPodName ? `Back to ${trimmedPodName}` : "Back to pod";
  const podHref = buildPodCustomerPath(podSlug);

  return (
    <header className="border-b border-oo-light-stone bg-oo-warm-white">
      <PageShell className="py-4 sm:py-5">
        <Link
          href={podHref}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-oo-stone-gray transition-colors hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <span aria-hidden>←</span>
          {backLabel}
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
          <VendorLogo
            imageUrl={vendorImageUrl}
            vendorName={vendorName}
            className="h-16 w-16 shrink-0 rounded-xl border border-oo-light-stone sm:h-20 sm:w-20"
            sizes="80px"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h1 className="text-xl font-bold tracking-tight text-oo-charcoal sm:text-2xl">
                  {vendorName}
                </h1>
                <p className="mt-1 text-sm text-oo-stone-gray">
                  at{" "}
                  <Link
                    href={podHref}
                    className="font-semibold text-oo-charcoal underline decoration-oo-light-stone underline-offset-2 hover:text-brand"
                  >
                    {trimmedPodName || "pod"}
                  </Link>
                </p>
              </div>
              <FavoriteVendorButton vendorId={vendorId} podId={podId} vendorName={vendorName} />
            </div>

            <ul className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <li>
                <VendorStatusBadge status={availabilityStatus} menuOnly={menuOnly} />
              </li>
              {cuisineCategory?.trim() ? (
                <li className="text-oo-stone-gray">{cuisineCategory.trim()}</li>
              ) : null}
            </ul>

            <div className="mt-3 max-w-md">
              <VendorHoursDisclosure display={hoursDisplay} />
            </div>

            {vendorDescription?.trim() && (
              <p className="mt-2 line-clamp-2 max-w-2xl text-sm leading-relaxed text-oo-stone-gray">
                {vendorDescription.trim()}
              </p>
            )}
          </div>
        </div>

        {bannerLine && (
          <div
            className={cn(
              "mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950"
            )}
            role="status"
          >
            <p className="font-semibold">{bannerLine}</p>
            <p className="mt-0.5 text-xs text-amber-900/90">You can still browse the menu.</p>
          </div>
        )}
      </PageShell>
    </header>
  );
}

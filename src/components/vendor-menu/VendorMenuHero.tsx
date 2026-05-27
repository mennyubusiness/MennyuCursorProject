import Link from "next/link";
import { VendorLogo } from "@/components/images/VendorLogo";
import { FavoriteVendorButton } from "@/components/retention/FavoriteVendorButton";
import { PageShell } from "@/components/layout/page-shell";
import type { VendorAvailabilityStatus } from "@/lib/vendor-availability";
import { cn } from "@/lib/cn";

function VendorStatusBadge({ status }: { status: VendorAvailabilityStatus }) {
  if (status === "open") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
        Open
      </span>
    );
  }
  const label =
    status === "closed"
      ? "Closed"
      : status === "mennyu_paused"
        ? "Not accepting orders"
        : "Unavailable";
  return (
    <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">
      {label}
    </span>
  );
}

type VendorMenuHeroProps = {
  podId: string;
  podName: string;
  podAccentColor: string | null;
  vendorId: string;
  vendorName: string;
  vendorDescription: string | null;
  vendorImageUrl: string | null;
  vendorAccentColor: string | null;
  cuisineCategory: string | null;
  availabilityStatus: VendorAvailabilityStatus;
  bannerLine: string | null;
};

export function VendorMenuHero({
  podId,
  podName,
  podAccentColor,
  vendorId,
  vendorName,
  vendorDescription,
  vendorImageUrl,
  vendorAccentColor,
  cuisineCategory,
  availabilityStatus,
  bannerLine,
}: VendorMenuHeroProps) {
  const accent = vendorAccentColor ?? podAccentColor;

  return (
    <header className="border-b border-oo-light-stone bg-oo-warm-white">
      <PageShell className="py-4 sm:py-5">
        <nav
          className="mb-4 text-xs text-oo-stone-gray"
          aria-label="Breadcrumb"
          style={accent ? { borderBottomColor: accent } : undefined}
        >
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link
                href={`/pod/${podId}`}
                className="font-semibold text-oo-charcoal transition hover:text-brand"
                style={podAccentColor ? { color: podAccentColor } : undefined}
              >
                {podName}
              </Link>
            </li>
            <li aria-hidden className="text-oo-light-stone">
              /
            </li>
            <li className="font-medium text-oo-charcoal">{vendorName}</li>
          </ol>
        </nav>

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
                    href={`/pod/${podId}`}
                    className="font-semibold text-oo-charcoal underline decoration-oo-light-stone underline-offset-2 hover:text-brand"
                  >
                    {podName}
                  </Link>
                </p>
              </div>
              <FavoriteVendorButton vendorId={vendorId} podId={podId} vendorName={vendorName} />
            </div>

            <ul className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-oo-stone-gray">
              <li>
                <VendorStatusBadge status={availabilityStatus} />
              </li>
              {cuisineCategory?.trim() && (
                <li className="text-oo-stone-gray">{cuisineCategory.trim()}</li>
              )}
              <li className="text-oo-stone-gray">Pickup at pod</li>
              <li className="text-oo-stone-gray">Shared multi-vendor cart</li>
            </ul>

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

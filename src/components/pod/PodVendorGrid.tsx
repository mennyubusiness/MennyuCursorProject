import { PodVendorCard } from "@/components/pod/PodVendorCard";
import type { PodVendorCardVendor } from "@/components/pod/PodVendorCard";
import type { VendorHoursDisplayModel } from "@/lib/vendor-hours-display";

export type PodVendorGridRow = {
  vendor: PodVendorCardVendor;
  isFeatured: boolean;
  availability: {
    unavailable: boolean;
    statusLabel: string;
    showBrowseHint: boolean;
  };
  hoursDisplay: VendorHoursDisplayModel;
};

type PodVendorGridProps = {
  podSlug: string;
  rows: PodVendorGridRow[];
  highlightVendorId?: string | null;
  listClassName?: string;
};

export function PodVendorGrid({
  podSlug,
  rows,
  highlightVendorId = null,
  listClassName,
}: PodVendorGridProps) {
  return (
    <ul
      className={
        listClassName ??
        "grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-4 xl:grid-cols-4"
      }
    >
      {rows.map(({ vendor, isFeatured, availability, hoursDisplay }) => {
        const isHighlighted = highlightVendorId === vendor.id;
        return (
          <li
            key={vendor.id}
            id={`pod-vendor-${vendor.id}`}
            className={
              isHighlighted
                ? "scroll-mt-36 rounded-xl p-0.5 ring-2 ring-brand ring-offset-2 ring-offset-oo-cream"
                : "scroll-mt-36 min-h-0"
            }
          >
            <PodVendorCard
              podSlug={podSlug}
              variant="grid"
              vendor={vendor}
              isFeatured={isFeatured}
              availability={availability}
              hoursDisplay={hoursDisplay}
            />
          </li>
        );
      })}
    </ul>
  );
}

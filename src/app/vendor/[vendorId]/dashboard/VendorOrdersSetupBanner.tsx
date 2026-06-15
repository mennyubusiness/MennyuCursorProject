import Link from "next/link";

import { vendorSettingsSectionHref } from "@/lib/vendor-settings-sections";

type Props = {
  vendorId: string;
  show: boolean;
};

/** Compact nudge when POS or payouts are not fully configured. */
export function VendorOrdersSetupBanner({ vendorId, show }: Props) {
  if (!show) return null;

  return (
    <div className="rounded-lg border border-oo-light-stone bg-oo-cream px-3 py-2.5 text-sm text-oo-charcoal">
      <Link
        href={vendorSettingsSectionHref(vendorId, "overview")}
        className="font-semibold text-oo-charcoal underline decoration-stone-300 underline-offset-2 hover:decoration-stone-600"
      >
        Setup incomplete
      </Link>
      <span className="text-oo-stone-gray"> — finish POS connection and payouts in Settings when you are ready.</span>
    </div>
  );
}

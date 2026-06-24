import Link from "next/link";

import { vendorSettingsSectionHref } from "@/lib/vendor-settings-sections";

type Props = {
  vendorId: string;
  show: boolean;
};

/** Compact nudge when POS or payments are not fully configured. */
export function VendorOrdersSetupBanner({ vendorId, show }: Props) {
  if (!show) return null;

  return (
    <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-sm text-oo-charcoal">
      <Link
        href={vendorSettingsSectionHref(vendorId, "overview")}
        className="font-semibold text-oo-charcoal underline decoration-stone-300 underline-offset-2 hover:decoration-stone-600"
      >
        Setup incomplete
      </Link>
      <span className="text-oo-stone-gray">
        {" "}
        — finish POS connection and payments setup in Settings when you are ready.
      </span>
    </div>
  );
}

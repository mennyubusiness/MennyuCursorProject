import Link from "next/link";

type Props = {
  vendorId: string;
  show: boolean;
};

/** Compact nudge when POS or payouts are not fully configured. */
export function VendorOrdersSetupBanner({ vendorId, show }: Props) {
  if (!show) return null;

  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-700">
      <Link
        href={`/vendor/${vendorId}/settings#vendor-settings-pos`}
        className="font-semibold text-stone-900 underline decoration-stone-300 underline-offset-2 hover:decoration-stone-600"
      >
        Setup incomplete
      </Link>
      <span className="text-stone-600"> — finish POS connection and payouts in Settings when you are ready.</span>
    </div>
  );
}

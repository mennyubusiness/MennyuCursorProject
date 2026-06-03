import {
  BLOCKED_VENDOR_TRANSFER_STILL_OWED,
  adminVendorConnectTransferStatusLabel,
  platformPayoutDisplayLabel,
  STRIPE_PLATFORM_PAYOUT_NOT_VENDOR_PAYMENT,
  type PlatformPayoutDisplayStatus,
} from "@/lib/stripe-money-movement";

function formatMoney(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export type StripeMoneyMovementBreakdownProps = {
  customerPaymentCents: number;
  stripeProcessingFeeCents: number | null;
  stripeNetToPlatformCents: number | null;
  platformPayout: PlatformPayoutDisplayStatus;
  vendorConnectTransferOwedCents: number;
  vendorConnectTransferStatus: string;
  vendorStillOwedCents: number;
  openOrderRetainedCents: number | null;
  stripeTransferId?: string | null;
  currency?: string;
  compact?: boolean;
  showBlockedNote?: boolean;
};

export function StripeMoneyMovementBreakdown({
  customerPaymentCents,
  stripeProcessingFeeCents,
  stripeNetToPlatformCents,
  platformPayout,
  vendorConnectTransferOwedCents,
  vendorConnectTransferStatus,
  vendorStillOwedCents,
  openOrderRetainedCents,
  stripeTransferId,
  currency = "usd",
  compact = false,
  showBlockedNote = false,
}: StripeMoneyMovementBreakdownProps) {
  const rows = [
    { label: "Customer payment total", value: formatMoney(customerPaymentCents, currency) },
    {
      label: "Stripe processing fee",
      value:
        stripeProcessingFeeCents != null
          ? formatMoney(stripeProcessingFeeCents, currency)
          : "Unknown",
    },
    {
      label: "Stripe net to platform",
      value:
        stripeNetToPlatformCents != null
          ? formatMoney(stripeNetToPlatformCents, currency)
          : "Unknown",
    },
    {
      label: "Platform payout to Open Order bank",
      value: platformPayoutDisplayLabel(platformPayout),
      emphasize: platformPayout.kind === "paid_out",
    },
    {
      label: "Vendor Connect transfer owed",
      value: formatMoney(vendorConnectTransferOwedCents, currency),
    },
    {
      label: "Vendor Connect transfer status",
      value: adminVendorConnectTransferStatusLabel(vendorConnectTransferStatus),
    },
    {
      label: "Vendor still owed",
      value: formatMoney(vendorStillOwedCents, currency),
      emphasize: vendorStillOwedCents > 0,
    },
    {
      label: "Open Order retained amount",
      value:
        openOrderRetainedCents != null
          ? formatMoney(openOrderRetainedCents, currency)
          : "Unknown",
    },
  ];

  return (
    <div className={compact ? "space-y-2 text-xs" : "space-y-3 text-sm"}>
      <p className="leading-relaxed text-oo-stone-gray">{STRIPE_PLATFORM_PAYOUT_NOT_VENDOR_PAYMENT}</p>
      <dl className="grid gap-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-3">
            <dt className="text-oo-stone-gray">{row.label}</dt>
            <dd
              className={`text-right tabular-nums ${
                row.emphasize ? "font-semibold text-amber-900" : "font-medium text-oo-charcoal"
              }`}
            >
              {row.value}
            </dd>
          </div>
        ))}
        {stripeTransferId?.trim() && (
          <div className="flex justify-between gap-3">
            <dt className="text-oo-stone-gray">Stripe Connect transfer</dt>
            <dd className="break-all font-mono text-[10px] text-oo-charcoal">{stripeTransferId}</dd>
          </div>
        )}
      </dl>
      {showBlockedNote && vendorStillOwedCents > 0 && (
        <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-950">
          {BLOCKED_VENDOR_TRANSFER_STILL_OWED}
        </p>
      )}
    </div>
  );
}

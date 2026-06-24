import {
  ADMIN_ACCOUNTING_CONTEXT_INTRO,
  BLOCKED_VENDOR_TRANSFER_STILL_OWED,
  adminVendorConnectTransferStatusLabel,
  type PlatformPayoutDisplayStatus,
} from "@/lib/stripe-money-movement";
import { buildVendorPayoutTransferGroup } from "@/lib/vendor-payout-transfer-stripe-metadata";
import { StripeMoneyMovementBreakdown } from "@/components/admin/StripeMoneyMovementBreakdown";

function formatMoney(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export type VendorTransferRowDetailsProps = {
  currency: string;
  status: string;
  destinationAccountId?: string | null;
  failureMessage: string | null;
  blockedReason: string | null;
  idempotencyKey: string | null;
  batchKey: string | null;
  stripeTransferId: string | null;
  stripeChargeId?: string | null;
  orderId?: string | null;
  reconcileNote?: string | null;
  showBlockedNote?: boolean;
  moneyMovement: {
    customerPaymentCents: number;
    stripeProcessingFeeCents: number | null;
    stripeNetToPlatformCents: number | null;
    vendorConnectTransferOwedCents: number;
    vendorStillOwedCents: number;
    openOrderRetainedCents: number;
    stripeBalanceTransactionId: string | null;
    platformPayout: PlatformPayoutDisplayStatus;
  };
};

export function VendorTransferRowDetails({
  currency,
  status,
  destinationAccountId,
  failureMessage,
  blockedReason,
  idempotencyKey,
  batchKey,
  stripeTransferId,
  stripeChargeId,
  orderId,
  reconcileNote,
  showBlockedNote,
  moneyMovement: mm,
}: VendorTransferRowDetailsProps) {
  const customerPaid =
    mm.customerPaymentCents > 0 || Boolean(mm.stripeBalanceTransactionId?.trim());
  const transferGroup = orderId?.trim() ? buildVendorPayoutTransferGroup(orderId.trim()) : null;

  const transferRows = [
    {
      label: "Customer paid",
      value: customerPaid ? "Yes" : "No",
    },
    {
      label: "Vendor still owed",
      value: formatMoney(mm.vendorStillOwedCents, currency),
      emphasize: mm.vendorStillOwedCents > 0,
    },
    {
      label: "Open Order retained amount",
      value: formatMoney(mm.openOrderRetainedCents, currency),
    },
    {
      label: "Stripe processing fee",
      value:
        mm.stripeProcessingFeeCents != null
          ? formatMoney(mm.stripeProcessingFeeCents, currency)
          : "Unknown",
    },
    {
      label: "Vendor Connect transfer status",
      value: adminVendorConnectTransferStatusLabel(status),
    },
  ];

  return (
    <div className="space-y-3 text-xs">
      <dl className="grid max-w-xl gap-1.5">
        {transferRows.map((row) => (
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
        {stripeChargeId?.trim() ? (
          <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-3">
            <dt className="text-oo-stone-gray" title="Stripe source_transaction for charge-linked transfers">
              Source transaction
            </dt>
            <dd className="break-all font-mono text-[10px] text-oo-charcoal sm:max-w-md sm:text-right">
              {stripeChargeId.trim()}
            </dd>
          </div>
        ) : null}
        {transferGroup ? (
          <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-3">
            <dt className="text-oo-stone-gray" title="Stripe transfer_group scoped to the order">
              Transfer group
            </dt>
            <dd className="break-all font-mono text-[10px] text-oo-charcoal sm:max-w-md sm:text-right">
              {transferGroup}
            </dd>
          </div>
        ) : null}
        {failureMessage?.trim() ? (
          <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-3">
            <dt className="text-oo-stone-gray">Raw Stripe error</dt>
            <dd className="whitespace-pre-wrap break-words font-mono text-[10px] text-oo-charcoal sm:max-w-md sm:text-right">
              {failureMessage.trim()}
            </dd>
          </div>
        ) : null}
        {blockedReason?.trim() ? (
          <div className="flex justify-between gap-3">
            <dt className="text-oo-stone-gray">Blocked reason</dt>
            <dd className="font-mono text-[10px] text-oo-charcoal">{blockedReason.trim()}</dd>
          </div>
        ) : null}
        {reconcileNote?.trim() ? (
          <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-3">
            <dt className="text-oo-stone-gray">Reconciliation result</dt>
            <dd className="text-right text-oo-charcoal">{reconcileNote.trim()}</dd>
          </div>
        ) : null}
        {destinationAccountId?.trim() ? (
          <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-3">
            <dt className="text-oo-stone-gray">Destination account</dt>
            <dd className="break-all font-mono text-[10px] text-oo-charcoal sm:max-w-md sm:text-right">
              {destinationAccountId.trim()}
            </dd>
          </div>
        ) : null}
        {stripeTransferId?.trim() ? (
          <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-3">
            <dt className="text-oo-stone-gray">Stripe transfer ID</dt>
            <dd className="break-all font-mono text-[10px] text-oo-charcoal sm:max-w-md sm:text-right">
              {stripeTransferId.trim()}
            </dd>
          </div>
        ) : null}
        {idempotencyKey?.trim() ? (
          <div className="flex justify-between gap-3">
            <dt className="text-oo-stone-gray" title="Stripe idempotency key for transfer create">
              Idempotency key
            </dt>
            <dd className="break-all font-mono text-[10px] text-oo-charcoal">{idempotencyKey.trim()}</dd>
          </div>
        ) : null}
        {batchKey?.trim() ? (
          <div className="flex justify-between gap-3">
            <dt className="text-oo-stone-gray">Transfer batch</dt>
            <dd className="font-mono text-[10px] text-oo-charcoal">{batchKey.trim()}</dd>
          </div>
        ) : null}
      </dl>

      {showBlockedNote && mm.vendorStillOwedCents > 0 ? (
        <p className="max-w-xl rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-amber-950">
          {BLOCKED_VENDOR_TRANSFER_STILL_OWED}
        </p>
      ) : null}

      <details className="max-w-xl">
        <summary className="cursor-pointer font-medium text-oo-stone-gray hover:text-oo-charcoal">
          Platform payout information
        </summary>
        <div className="mt-2 rounded-lg border border-oo-light-stone bg-white/80 p-3">
          <p className="mb-2 leading-relaxed text-oo-stone-gray">{ADMIN_ACCOUNTING_CONTEXT_INTRO}</p>
          <StripeMoneyMovementBreakdown
            compact
            mode="accounting"
            currency={currency}
            customerPaymentCents={mm.customerPaymentCents}
            stripeProcessingFeeCents={mm.stripeProcessingFeeCents}
            stripeNetToPlatformCents={mm.stripeNetToPlatformCents}
            platformPayout={mm.platformPayout}
            vendorConnectTransferOwedCents={mm.vendorConnectTransferOwedCents}
            vendorConnectTransferStatus={adminVendorConnectTransferStatusLabel(status)}
            vendorStillOwedCents={mm.vendorStillOwedCents}
            openOrderRetainedCents={mm.openOrderRetainedCents}
            stripeTransferId={stripeTransferId}
          />
        </div>
      </details>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { formatMobileBottomActionSummary } from "@/lib/mobile-customer-ui";
import { CHECKOUT_SECTION_HEADINGS } from "@/lib/checkout-place-order-cta-state";

export type CheckoutOrderSummaryVendorGroup = {
  vendorId: string;
  vendorName: string;
  lines: Array<{ name: string; qty: number; cents: number }>;
};

type CheckoutOrderSummaryProps = {
  vendorGroups: CheckoutOrderSummaryVendorGroup[];
  itemCount: number;
  vendorCount: number;
  subtotalCents: number;
  serviceFeeCents: number;
  serviceFeePercentLabel: string;
  taxCents: number;
  dueBeforeTipCents: number;
  /** Collapse line items on mobile by default when order is long. */
  defaultCollapsedOnMobile?: boolean;
  compact?: boolean;
};

export function CheckoutOrderSummary({
  vendorGroups,
  itemCount,
  vendorCount,
  subtotalCents,
  serviceFeeCents,
  serviceFeePercentLabel,
  taxCents,
  dueBeforeTipCents,
  defaultCollapsedOnMobile,
  compact = false,
}: CheckoutOrderSummaryProps) {
  const collapseByDefault = defaultCollapsedOnMobile ?? itemCount > 3;
  const [mobileExpanded, setMobileExpanded] = useState(!collapseByDefault);

  const compactHeading = useMemo(() => {
    const vendorPart = vendorCount > 1 ? ` · ${vendorCount} vendors` : "";
    return `${CHECKOUT_SECTION_HEADINGS.orderSummary} · ${formatMobileBottomActionSummary(itemCount, dueBeforeTipCents)}${vendorPart}`;
  }, [vendorCount, itemCount, dueBeforeTipCents]);

  const totalsBlock = (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between gap-4">
        <dt className="text-oo-stone-gray">Food subtotal</dt>
        <dd className="tabular-nums font-medium text-oo-charcoal">
          ${(subtotalCents / 100).toFixed(2)}
        </dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt className="text-oo-stone-gray">Service fee ({serviceFeePercentLabel})</dt>
        <dd className="tabular-nums text-oo-charcoal">${(serviceFeeCents / 100).toFixed(2)}</dd>
      </div>
      {taxCents > 0 ? (
        <div className="flex justify-between gap-4">
          <dt className="text-oo-stone-gray">Sales tax (pickup)</dt>
          <dd className="tabular-nums text-oo-charcoal">${(taxCents / 100).toFixed(2)}</dd>
        </div>
      ) : null}
      <div className="flex justify-between gap-4 border-t border-oo-light-stone pt-2 text-base">
        <dt className="font-semibold text-oo-charcoal">Due before tip</dt>
        <dd className="tabular-nums font-bold text-oo-charcoal">
          ${(dueBeforeTipCents / 100).toFixed(2)}
        </dd>
      </div>
    </dl>
  );

  if (compact) {
    return (
      <div className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-4 shadow-sm sm:p-5">
        <p className="text-sm font-bold text-oo-charcoal">{compactHeading}</p>
        <div className="mt-3">{totalsBlock}</div>
      </div>
    );
  }

  return (
    <section
      id="checkout-order-summary"
      className="rounded-xl border border-oo-light-stone bg-oo-warm-white shadow-sm"
    >
      <div className="flex items-start justify-between gap-3 border-b border-oo-light-stone px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-oo-charcoal sm:hidden">{compactHeading}</h2>
          <h2 className="hidden text-base font-bold text-oo-charcoal sm:block">
            {CHECKOUT_SECTION_HEADINGS.orderSummary}
          </h2>
          <p className="mt-0.5 hidden text-sm text-oo-stone-gray sm:block">
            {itemCount} item{itemCount !== 1 ? "s" : ""}
            {vendorCount > 1 ? ` · ${vendorCount} vendors` : ""} · Due before tip $
            {(dueBeforeTipCents / 100).toFixed(2)}
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg px-2 py-1 text-sm font-semibold text-brand hover:underline sm:hidden"
          aria-expanded={mobileExpanded}
          aria-controls="checkout-order-summary-details"
          onClick={() => setMobileExpanded((open) => !open)}
        >
          {mobileExpanded ? "Hide" : "Details"}
        </button>
      </div>

      <div
        id="checkout-order-summary-details"
        className={cn(
          "divide-y divide-oo-light-stone px-4 py-2 sm:block",
          mobileExpanded ? "block" : "hidden sm:block"
        )}
      >
        {vendorGroups.map((group) => (
          <div key={group.vendorId} className="py-4 first:pt-2 last:pb-2">
            <p className="font-semibold text-oo-charcoal">{group.vendorName}</p>
            <ul className="mt-2 space-y-1.5 text-sm text-oo-stone-gray">
              {group.lines.map((line, index) => (
                <li key={`${group.vendorId}-${index}`} className="flex justify-between gap-4">
                  <span className="min-w-0">
                    {line.name}
                    <span className="text-oo-stone-gray/70"> × {line.qty}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-oo-charcoal">
                    ${(line.cents / 100).toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-oo-light-stone bg-oo-cream/40 px-4 py-4 sm:px-5">{totalsBlock}</div>
    </section>
  );
}

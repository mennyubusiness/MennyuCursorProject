import type { ReactNode } from "react";
import Link from "next/link";

import {
  SMS_ACCOUNT_OPT_IN_LABEL,
  SMS_CHECKOUT_OPT_IN_LABEL,
  SMS_MESSAGE_TYPES_INLINE,
} from "@/lib/legal/sms-consent-copy";

function MockPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-xl border border-oo-light-stone bg-white shadow-sm"
      data-sms-reviewer-mockup
    >
      <p className="border-b border-oo-light-stone bg-oo-cream/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">
        Reviewer example — {title}
      </p>
      <div className="p-4">{children}</div>
    </div>
  );
}

function MockCheckbox({
  id,
  label,
  checked = false,
}: {
  id: string;
  label: string;
  checked?: boolean;
}) {
  return (
    <label htmlFor={id} className="flex cursor-default gap-2.5 text-sm text-oo-charcoal">
      <input
        id={id}
        type="checkbox"
        readOnly
        checked={checked}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-stone-300 text-brand"
        aria-hidden
      />
      <span>{label}</span>
    </label>
  );
}

function MockComplianceDisclosure() {
  return (
    <p className="mt-2 pl-6 text-xs leading-relaxed text-oo-stone-gray">
      Messages may include {SMS_MESSAGE_TYPES_INLINE}. Message frequency varies. Message and data rates
      may apply. Carriers are not liable for delayed or undelivered messages. Reply STOP to opt out or
      HELP for help. View our{" "}
      <Link href="/privacy" className="font-semibold text-brand hover:underline">
        Privacy Policy
      </Link>{" "}
      and{" "}
      <Link href="/terms" className="font-semibold text-brand hover:underline">
        Terms of Service
      </Link>
      .
    </p>
  );
}

export function SmsConsentCheckoutReviewerMockup() {
  return (
    <MockPanel title="Checkout contact section">
      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-oo-charcoal">
            Mobile number <span className="font-normal text-oo-stone-gray">(optional)</span>
          </p>
          <p className="mt-1 text-sm text-oo-stone-gray">
            We&apos;ll use this only for order updates if you choose SMS.
          </p>
          <div
            className="mt-2 max-w-md rounded-lg border border-dashed border-oo-light-stone bg-oo-cream/40 px-3 py-2 text-sm text-oo-stone-gray"
            aria-hidden
          >
            (555) 123-4567
          </div>
        </div>
        <div className="max-w-md">
          <MockCheckbox id="mock-checkout-sms" label={SMS_CHECKOUT_OPT_IN_LABEL} />
          <MockComplianceDisclosure />
        </div>
        <p className="rounded-lg border border-oo-light-stone bg-oo-cream/60 px-3 py-3 text-sm text-oo-stone-gray">
          You can still track your order on the order status page.
        </p>
        <p className="text-xs text-oo-stone-gray">
          SMS checkbox is <strong className="text-oo-charcoal">optional</strong> and{" "}
          <strong className="text-oo-charcoal">unchecked by default</strong> unless the signed-in
          customer already has stored transactional consent.
        </p>
      </div>
    </MockPanel>
  );
}

export function SmsConsentAccountReviewerMockup() {
  return (
    <MockPanel title="Account phone / order updates">
      <div className="space-y-4">
        <p className="text-sm text-oo-stone-gray">
          Use your phone number for verification and optional order updates. You can also track orders
          from the order status screen after checkout.
        </p>
        <div>
          <p className="text-sm font-semibold text-oo-charcoal">Mobile number</p>
          <div
            className="mt-2 max-w-md rounded-lg border border-dashed border-oo-light-stone bg-oo-cream/40 px-3 py-2 text-sm text-oo-stone-gray"
            aria-hidden
          >
            Enter mobile number
          </div>
        </div>
        <div className="max-w-md">
          <MockCheckbox id="mock-account-sms" label={SMS_ACCOUNT_OPT_IN_LABEL} />
          <MockComplianceDisclosure />
        </div>
        <p className="text-sm text-oo-stone-gray">
          Customer must check SMS updates before &ldquo;Send verification code&rdquo; is enabled.
          Transactional SMS opt-in is recorded when verification completes with the checkbox still
          checked.
        </p>
        <p className="text-xs text-oo-stone-gray">
          SMS checkbox is <strong className="text-oo-charcoal">optional</strong> and{" "}
          <strong className="text-oo-charcoal">unchecked by default</strong> unless editing the same
          verified number that already has stored consent.
        </p>
      </div>
    </MockPanel>
  );
}

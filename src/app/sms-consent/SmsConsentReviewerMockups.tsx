import type { ReactNode } from "react";
import Link from "next/link";

import {
  SMS_PHONE_NUMBER_LABEL,
  SMS_PHONE_OPTIONAL_TAG,
  SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL,
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

const disclosureBoxClassName =
  "rounded-lg border border-oo-light-stone bg-white px-3 py-3";

function MockPhoneNumberLabel() {
  return (
    <p className="text-sm font-semibold text-oo-charcoal">
      {SMS_PHONE_NUMBER_LABEL}{" "}
      <span className="ml-1 inline-flex rounded-md bg-oo-cream px-1.5 py-0.5 text-xs font-medium text-oo-stone-gray">
        {SMS_PHONE_OPTIONAL_TAG}
      </span>
    </p>
  );
}

function MockLegalLinks() {
  return (
    <p className="text-xs text-oo-stone-gray">
      <Link href="/privacy" className="font-semibold text-brand hover:underline">
        Privacy Policy
      </Link>
      <span aria-hidden="true"> · </span>
      <Link href="/terms" className="font-semibold text-brand hover:underline">
        Terms of Service
      </Link>
    </p>
  );
}

function MockSmsConsentStack({ transactionalId }: { transactionalId: string }) {
  return (
    <div className="space-y-3">
      <div className={disclosureBoxClassName}>
        <label htmlFor={transactionalId} className="flex cursor-default gap-2.5 text-sm leading-relaxed text-oo-charcoal">
          <input
            id={transactionalId}
            type="checkbox"
            readOnly
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-stone-300 text-brand"
            aria-hidden
          />
          <span>{SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL}</span>
        </label>
      </div>
      <MockLegalLinks />
    </div>
  );
}

export function SmsConsentCheckoutReviewerMockup() {
  return (
    <MockPanel title="Checkout contact section">
      <div className="space-y-4">
        <div>
          <MockPhoneNumberLabel />
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
          <MockSmsConsentStack transactionalId="mock-checkout-sms" />
        </div>
        <p className="rounded-lg border border-oo-light-stone bg-oo-cream/60 px-3 py-3 text-sm text-oo-stone-gray">
          You can still track your order on the order status page.
        </p>
        <p className="text-xs text-oo-stone-gray">
          Open Order does not send marketing or promotional SMS. The transactional checkbox is the only
          SMS opt-in on this form. SMS is optional and not required to place an order. The checkbox is{" "}
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
          <MockPhoneNumberLabel />
          <div
            className="mt-2 max-w-md rounded-lg border border-dashed border-oo-light-stone bg-oo-cream/40 px-3 py-2 text-sm text-oo-stone-gray"
            aria-hidden
          >
            Enter mobile number
          </div>
        </div>
        <div className="max-w-md">
          <MockSmsConsentStack transactionalId="mock-account-sms" />
        </div>
        <p className="text-sm text-oo-stone-gray">
          Customer must check transactional SMS consent before &ldquo;Send verification code&rdquo; is
          enabled. Transactional SMS opt-in is recorded when verification completes with the checkbox
          still checked.
        </p>
        <p className="text-xs text-oo-stone-gray">
          Open Order does not send marketing or promotional SMS. Group order join is not an SMS opt-in
          path. The transactional checkbox is <strong className="text-oo-charcoal">optional</strong> and{" "}
          <strong className="text-oo-charcoal">unchecked by default</strong> unless editing the same
          verified number that already has stored consent.
        </p>
      </div>
    </MockPanel>
  );
}

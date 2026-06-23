"use client";

import Link from "next/link";

import {
  SMS_MARKETING_NOT_OFFERED_LABEL,
  SMS_PHONE_NUMBER_LABEL,
  SMS_PHONE_OPTIONAL_TAG,
  SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL,
} from "@/lib/legal/sms-consent-copy";

type SmsConsentCheckboxProps = {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
  /** @deprecated Checkout and account share the same Twilio disclosure layout. */
  layout?: "checkout" | "account" | "full";
};

const checkboxClassName =
  "mt-0.5 h-4 w-4 shrink-0 rounded border-stone-300 text-brand focus:ring-brand";

const disclosureBoxClassName =
  "rounded-lg border border-oo-light-stone bg-oo-cream/40 px-3 py-3";

/** Shared phone field label: "Phone Number" with inline Optional tag. */
export function SmsPhoneNumberLabel({ className = "" }: { className?: string }) {
  return (
    <span className={`text-sm font-semibold text-oo-charcoal ${className}`.trim()}>
      {SMS_PHONE_NUMBER_LABEL}{" "}
      <span className="ml-1 inline-flex rounded-md bg-oo-cream px-1.5 py-0.5 text-xs font-medium text-oo-stone-gray">
        {SMS_PHONE_OPTIONAL_TAG}
      </span>
    </span>
  );
}

function SmsLegalLinks({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-oo-stone-gray ${className}`.trim()}>
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

/**
 * Twilio-aligned SMS consent block: disabled marketing row, active transactional row, legal links.
 * Transactional checkbox is unchecked by default unless parent restores stored consent.
 */
export function SmsConsentCheckbox({
  id,
  checked,
  onChange,
  className = "",
  disabled = false,
}: SmsConsentCheckboxProps) {
  const marketingId = `${id}-marketing`;

  return (
    <div className={`space-y-3 ${className}`.trim()}>
      <div className={disclosureBoxClassName}>
        <label htmlFor={marketingId} className="flex gap-2.5 text-sm text-oo-stone-gray">
          <input
            id={marketingId}
            name="smsMarketingConsent"
            type="checkbox"
            checked={false}
            disabled
            readOnly
            aria-disabled="true"
            className={`${checkboxClassName} cursor-not-allowed opacity-60`}
          />
          <span>{SMS_MARKETING_NOT_OFFERED_LABEL}</span>
        </label>
      </div>

      <div className={`${disclosureBoxClassName} bg-white`}>
        <label htmlFor={id} className="flex cursor-pointer gap-2.5 text-sm leading-relaxed text-oo-charcoal">
          <input
            id={id}
            name="smsConsent"
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
            className={checkboxClassName}
          />
          <span>{SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL}</span>
        </label>
      </div>

      <SmsLegalLinks />
    </div>
  );
}

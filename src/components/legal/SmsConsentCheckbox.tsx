"use client";

import Link from "next/link";

import { SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL } from "@/lib/legal/sms-consent-copy";

type SmsConsentCheckboxProps = {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
};

/**
 * Unchecked-by-default transactional SMS opt-in (TCPA / A2P). Required before send-code / submit.
 */
export function SmsConsentCheckbox({
  id,
  checked,
  onChange,
  className = "",
  disabled = false,
}: SmsConsentCheckboxProps) {
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="flex cursor-pointer gap-2.5 text-xs leading-relaxed text-oo-stone-gray"
      >
        <input
          id={id}
          name="smsConsent"
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-stone-300 text-brand focus:ring-brand"
        />
        <span>
          I agree to receive transactional SMS messages from OpenOrder at the phone number provided.
          Messages may include verification codes, order confirmations, order status updates,
          pickup-ready alerts, cancellation notices, and order issue notices. Message frequency
          varies. Message and data rates may apply. Reply STOP to opt out or HELP for help. View
          our{" "}
          <Link href="/privacy" className="font-semibold text-brand hover:underline">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/terms" className="font-semibold text-brand hover:underline">
            Terms of Service
          </Link>
          .
        </span>
      </label>
      <span className="sr-only">{SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL}</span>
    </div>
  );
}

"use client";

import Link from "next/link";

import {
  SMS_ACCOUNT_OPT_IN_LABEL,
  SMS_CHECKOUT_OPT_IN_LABEL,
  SMS_TRANSACTIONAL_COMPLIANCE_DISCLOSURE,
  SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL,
} from "@/lib/legal/sms-consent-copy";

type SmsConsentCheckboxProps = {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
  /** Checkout/account use a short opt-in label with compliance disclosure below. */
  layout?: "checkout" | "account" | "full";
};

function ComplianceDisclosure({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs leading-relaxed text-oo-stone-gray ${className}`.trim()}>
      Messages may include verification codes, order confirmations, order status updates,
      pickup-ready alerts, cancellation notices, completed-order notices, and order issue notices.
      Message frequency varies. Message and data rates may apply. Carriers are not liable for
      delayed or undelivered messages. Reply STOP to opt out or HELP for help. View our{" "}
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

function ShortOptInCheckbox({
  id,
  checked,
  onChange,
  disabled,
  label,
  className,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="flex cursor-pointer gap-2.5 text-sm text-oo-charcoal">
        <input
          id={id}
          name="smsConsent"
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-stone-300 text-brand focus:ring-brand"
        />
        <span>{label}</span>
      </label>
      <ComplianceDisclosure className="mt-2 pl-6" />
      <span className="sr-only">{SMS_TRANSACTIONAL_COMPLIANCE_DISCLOSURE}</span>
    </div>
  );
}

/**
 * Unchecked-by-default transactional SMS opt-in (TCPA / A2P).
 */
export function SmsConsentCheckbox({
  id,
  checked,
  onChange,
  className = "",
  disabled = false,
  layout = "full",
}: SmsConsentCheckboxProps) {
  if (layout === "checkout") {
    return (
      <ShortOptInCheckbox
        id={id}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        label={SMS_CHECKOUT_OPT_IN_LABEL}
        className={className}
      />
    );
  }

  if (layout === "account") {
    return (
      <ShortOptInCheckbox
        id={id}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        label={SMS_ACCOUNT_OPT_IN_LABEL}
        className={className}
      />
    );
  }

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
        <span>{SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL}</span>
      </label>
      <span className="sr-only">{SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL}</span>
    </div>
  );
}

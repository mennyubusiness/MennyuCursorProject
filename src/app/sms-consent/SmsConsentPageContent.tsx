import Link from "next/link";

import { LegalDocumentPage } from "@/components/legal/LegalDocumentPage";
import { LegalList, LegalSection } from "@/components/legal/LegalSection";
import {
  SMS_OPT_IN_LOCATIONS,
  SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL,
  SMS_TRANSACTIONAL_MESSAGE_TYPES,
} from "@/lib/legal/sms-consent-copy";
import { OPEN_ORDER_SUPPORT_EMAIL } from "@/lib/legal/constants";

export function SmsConsentPageContent() {
  return (
    <LegalDocumentPage
      title="SMS Messaging Consent"
      intro={
        <>
          <p>
            OpenOrder sends <strong className="font-semibold text-oo-charcoal">transactional SMS
            only</strong> — not marketing or promotional text messages. This page describes what you
            agree to when you opt in, how to get help, and where opt-in happens in the Open Order
            app.
          </p>
        </>
      }
    >
      <LegalSection id="transactional-only" title="Transactional messages only">
        <p>
          OpenOrder uses SMS to support your orders and account on the Open Order platform. We do not
          send marketing or promotional SMS under this program.
        </p>
        <p>Message types may include:</p>
        <LegalList items={[...SMS_TRANSACTIONAL_MESSAGE_TYPES]} />
        <p>
          Message frequency varies based on your account activity and order activity. Message and data
          rates may apply. Carriers are not liable for delayed or undelivered messages.
        </p>
      </LegalSection>

      <LegalSection id="opt-out-help" title="Opt out and help">
        <LegalList
          items={[
            "Reply STOP to any OpenOrder SMS message to opt out of transactional texts.",
            "Reply HELP for help.",
            `Contact OpenOrder at ${OPEN_ORDER_SUPPORT_EMAIL}.`,
          ]}
        />
      </LegalSection>

      <LegalSection id="policies" title="Privacy and terms">
        <p>
          See our{" "}
          <Link href="/privacy" className="font-semibold text-brand hover:underline">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/terms" className="font-semibold text-brand hover:underline">
            Terms of Service
          </Link>{" "}
          for how we collect, use, and protect mobile phone numbers and SMS consent.
        </p>
      </LegalSection>

      <LegalSection id="where-customers-opt-in" title="Where customers opt in">
        <p>
          Customers opt in during account phone verification, checkout, or phone verification before
          submitting their mobile number. You must check the consent box before we send a verification
          code or complete checkout with SMS order updates.
        </p>
        <LegalList items={[...SMS_OPT_IN_LOCATIONS]} />
        <p className="mt-4 font-medium text-oo-charcoal">Exact in-app checkbox copy</p>
        <blockquote className="mt-2 rounded-lg border border-oo-light-stone bg-oo-cream/80 px-4 py-3 text-sm leading-relaxed text-oo-charcoal">
          {SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL}
        </blockquote>
        <p className="mt-3 text-sm text-oo-stone-gray">
          In the app, &ldquo;Privacy Policy&rdquo; and &ldquo;Terms of Service&rdquo; link to{" "}
          <Link href="/privacy" className="font-semibold text-brand hover:underline">
            /privacy
          </Link>{" "}
          and{" "}
          <Link href="/terms" className="font-semibold text-brand hover:underline">
            /terms
          </Link>
          .
        </p>
      </LegalSection>
    </LegalDocumentPage>
  );
}

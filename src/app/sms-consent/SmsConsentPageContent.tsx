import Link from "next/link";
import Image from "next/image";

import { LegalDocumentPage } from "@/components/legal/LegalDocumentPage";
import { LegalList, LegalSection } from "@/components/legal/LegalSection";
import {
  SMS_ACTIVE_OPT_IN_PATHS,
  SMS_MESSAGE_TYPES_INLINE,
  SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL,
  SMS_TRANSACTIONAL_MESSAGE_TYPES,
  TWILIO_CONSENT_FORM_SCREENSHOT_PATH,
  TWILIO_CONSENT_FORM_SCREENSHOT_URL,
} from "@/lib/legal/sms-consent-copy";
import { OPEN_ORDER_SUPPORT_EMAIL } from "@/lib/legal/constants";
import {
  SmsConsentAccountReviewerMockup,
  SmsConsentCheckoutReviewerMockup,
} from "./SmsConsentReviewerMockups";

export function SmsConsentPageContent() {
  return (
    <LegalDocumentPage
      title="SMS Messaging Consent"
      intro={
        <>
          <p>
            <strong className="font-semibold text-oo-charcoal">Open Order</strong> sends{" "}
            <strong className="font-semibold text-oo-charcoal">transactional SMS only</strong> — not
            marketing or promotional text messages.
          </p>
          <p className="mt-3">
            Open Order does <strong className="font-semibold text-oo-charcoal">not</strong> send
            marketing or promotional SMS. The transactional checkbox below is the only active web
            opt-in path. Group order join is <strong className="font-semibold text-oo-charcoal">not</strong>{" "}
            an SMS opt-in path.
          </p>
          <p className="mt-3">
            SMS is <strong className="font-semibold text-oo-charcoal">optional</strong> and not required
            to place an order. Customers can track order status on the order status page without SMS.
          </p>
          <p className="mt-3">
            Message frequency varies based on order activity. Message and data rates may apply. Reply{" "}
            <strong className="text-oo-charcoal">STOP</strong> to opt out. Reply{" "}
            <strong className="text-oo-charcoal">HELP</strong> for help or contact{" "}
            <a
              href={`mailto:${OPEN_ORDER_SUPPORT_EMAIL}`}
              className="font-semibold text-brand hover:underline"
            >
              {OPEN_ORDER_SUPPORT_EMAIL}
            </a>
            . See our{" "}
            <Link href="/privacy" className="font-semibold text-brand hover:underline">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href="/terms" className="font-semibold text-brand hover:underline">
              Terms of Service
            </Link>
            .
          </p>
        </>
      }
    >
      <LegalSection id="transactional-only" title="Transactional messages only">
        <p>
          Open Order uses SMS to support your orders and account. We do not send marketing or
          promotional SMS under this program.
        </p>
        <p>Message types may include:</p>
        <LegalList items={[...SMS_TRANSACTIONAL_MESSAGE_TYPES]} />
        <p>
          Message frequency varies based on your order activity. Message and data rates may apply.
          Carriers are not liable for delayed or undelivered messages.
        </p>
      </LegalSection>

      <LegalSection id="opt-out-help" title="Opt out and help">
        <LegalList
          items={[
            "Reply STOP to any Open Order SMS message to opt out of transactional texts.",
            "Reply HELP for help.",
            `Contact Open Order at ${OPEN_ORDER_SUPPORT_EMAIL}.`,
            "Reply START to re-subscribe after opting out (keyword opt-in).",
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

      <LegalSection id="opt-in-paths" title="Supported SMS opt-in paths">
        <p>
          Customers opt in only through the paths below. Group order join is{" "}
          <strong className="text-oo-charcoal">not</strong> an SMS opt-in path.
        </p>
        <LegalList items={[...SMS_ACTIVE_OPT_IN_PATHS]} />
      </LegalSection>

      <LegalSection id="path-checkout" title="A. Checkout">
        <dl className="space-y-3 text-sm text-oo-charcoal">
          <div>
            <dt className="font-semibold">Reviewer route</dt>
            <dd className="mt-1 text-oo-stone-gray">
              Add items to cart, then open{" "}
              <code className="rounded bg-oo-cream px-1.5 py-0.5 text-xs">/checkout?cartId=…</code>{" "}
              (requires an active cart session). Public documentation:{" "}
              <Link href="/sms-consent" className="font-semibold text-brand hover:underline">
                /sms-consent
              </Link>
              .
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Step-by-step opt-in</dt>
            <dd className="mt-1">
              <ol className="list-decimal space-y-1 pl-5 text-oo-stone-gray">
                <li>Optionally enter a phone number (not required to checkout).</li>
                <li>
                  Review the marketing SMS row (disabled — not offered) and optionally check the
                  transactional SMS disclosure box.
                </li>
                <li>If SMS is checked, verify the number with a one-time code.</li>
                <li>Place the order. Transactional SMS consent is stored when the order is placed.</li>
              </ol>
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Checkbox optional?</dt>
            <dd className="mt-1 text-oo-stone-gray">Yes — customers may checkout without SMS.</dd>
          </div>
          <div>
            <dt className="font-semibold">Unchecked by default?</dt>
            <dd className="mt-1 text-oo-stone-gray">
              Yes, unless the signed-in customer already has stored transactional consent for their
              verified phone.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">When consent is stored</dt>
            <dd className="mt-1 text-oo-stone-gray">
              When the customer places the order with SMS updates enabled and a verified phone number.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Messages the user may receive</dt>
            <dd className="mt-1 text-oo-stone-gray">{SMS_MESSAGE_TYPES_INLINE}.</dd>
          </div>
        </dl>
        <div className="mt-6">
          <SmsConsentCheckoutReviewerMockup />
        </div>
      </LegalSection>

      <LegalSection id="path-account" title="B. Account phone / order updates">
        <dl className="space-y-3 text-sm text-oo-charcoal">
          <div>
            <dt className="font-semibold">Reviewer route</dt>
            <dd className="mt-1 text-oo-stone-gray">
              Sign in, then open{" "}
              <Link href="/account" className="font-semibold text-brand hover:underline">
                /account
              </Link>{" "}
              → Phone number section.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Step-by-step opt-in</dt>
            <dd className="mt-1">
              <ol className="list-decimal space-y-1 pl-5 text-oo-stone-gray">
                <li>Click Add phone number or Change.</li>
                <li>Enter a phone number.</li>
                <li>
                  Review the disabled marketing SMS row and check the transactional SMS disclosure box
                  to enable order updates.
                </li>
                <li>Send verification code and enter the one-time code.</li>
                <li>
                  Transactional SMS consent is stored when verification completes with the checkbox
                  still checked.
                </li>
              </ol>
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Checkbox optional?</dt>
            <dd className="mt-1 text-oo-stone-gray">
              Yes — SMS updates are not required to use the account or track orders.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Unchecked by default?</dt>
            <dd className="mt-1 text-oo-stone-gray">
              Yes, unless editing the same verified number that already has stored consent.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">When consent is stored</dt>
            <dd className="mt-1 text-oo-stone-gray">
              After successful phone verification when the SMS checkbox remains checked.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Messages the user may receive</dt>
            <dd className="mt-1 text-oo-stone-gray">{SMS_MESSAGE_TYPES_INLINE}.</dd>
          </div>
        </dl>
        <div className="mt-6">
          <SmsConsentAccountReviewerMockup />
        </div>
      </LegalSection>

      <LegalSection id="path-start" title="C. START keyword re-opt-in">
        <dl className="space-y-3 text-sm text-oo-charcoal">
          <div>
            <dt className="font-semibold">Reviewer route</dt>
            <dd className="mt-1 text-oo-stone-gray">
              Inbound SMS to the Open Order messaging number (no web page required).
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Step-by-step opt-in</dt>
            <dd className="mt-1">
              <ol className="list-decimal space-y-1 pl-5 text-oo-stone-gray">
                <li>Customer previously opted out by replying STOP.</li>
                <li>Customer replies START (or YES / UNSTOP) to an Open Order SMS number.</li>
                <li>Open Order records transactional SMS consent for that phone number again.</li>
              </ol>
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Checkbox optional?</dt>
            <dd className="mt-1 text-oo-stone-gray">
              N/A — keyword opt-in for customers who previously opted out.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Messages the user may receive</dt>
            <dd className="mt-1 text-oo-stone-gray">{SMS_MESSAGE_TYPES_INLINE}.</dd>
          </div>
        </dl>
      </LegalSection>

      <LegalSection id="checkbox-copy" title="Exact in-app consent language">
        <p>
          Checkout and account show a disabled marketing SMS row (Open Order does not send marketing
          texts), an active transactional SMS disclosure checkbox, and Privacy Policy / Terms of Service
          links directly below the checkboxes.
        </p>
        <p className="mt-4 font-medium text-oo-charcoal">Marketing SMS row (disabled, not stored)</p>
        <blockquote className="mt-2 rounded-lg border border-oo-light-stone bg-oo-cream/80 px-4 py-3 text-sm leading-relaxed text-oo-charcoal">
          Marketing SMS is not currently offered by Open Order. Open Order does not send marketing or
          promotional text messages.
        </blockquote>
        <p className="mt-4 font-medium text-oo-charcoal">Transactional SMS checkbox (active opt-in)</p>
        <blockquote className="mt-2 rounded-lg border border-oo-light-stone bg-oo-cream/80 px-4 py-3 text-sm leading-relaxed text-oo-charcoal">
          {SMS_TRANSACTIONAL_CONSENT_CHECKBOX_LABEL}
        </blockquote>
        <p className="mt-3 text-sm text-oo-stone-gray">
          Below the checkboxes, customers see links to{" "}
          <Link href="/privacy" className="font-semibold text-brand hover:underline">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/terms" className="font-semibold text-brand hover:underline">
            Terms of Service
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection id="twilio-consent-screenshot" title="Twilio reviewer consent form screenshot">
        <p>
          Static screenshot of the in-app SMS consent layout for Twilio campaign review. Public URL:{" "}
          <a
            href={TWILIO_CONSENT_FORM_SCREENSHOT_URL}
            className="font-semibold text-brand hover:underline break-all"
          >
            {TWILIO_CONSENT_FORM_SCREENSHOT_URL}
          </a>
        </p>
        <figure className="mt-4">
          <a
            href={TWILIO_CONSENT_FORM_SCREENSHOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="block overflow-hidden rounded-xl border border-oo-light-stone bg-white shadow-sm"
          >
            <Image
              src={TWILIO_CONSENT_FORM_SCREENSHOT_PATH}
              alt="Open Order SMS consent form showing Phone Number Optional, disabled marketing SMS row, transactional SMS opt-in checkbox, and Privacy Policy and Terms of Service links"
              width={960}
              height={720}
              className="h-auto w-full max-w-2xl"
              priority={false}
            />
          </a>
          <figcaption className="mt-2 text-sm text-oo-stone-gray">
            Checkout-style consent UI: optional phone number, disabled marketing SMS disclosure, active
            transactional SMS opt-in, and legal links.
          </figcaption>
        </figure>
      </LegalSection>
    </LegalDocumentPage>
  );
}

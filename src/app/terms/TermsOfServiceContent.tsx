import Link from "next/link";

import { LegalDocumentPage } from "@/components/legal/LegalDocumentPage";
import { LegalList, LegalSection, LegalSubheading } from "@/components/legal/LegalSection";
import {
  LEGAL_MAILING_ADDRESS_NOTICE,
  OPEN_ORDER_SUPPORT_EMAIL,
} from "@/lib/legal/constants";

export function TermsOfServiceContent() {
  return (
    <LegalDocumentPage
      title="Terms of Service"
      intro={
        <>
          <p>
            These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of Open Order’s
            website, ordering platform, text messaging services, and related services. &ldquo;Open
            Order,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo; refers to Open Order.
          </p>
          <p>
            By using Open Order, creating an account, placing an order, or receiving notifications, you
            agree to these Terms.
          </p>
        </>
      }
    >
      <LegalSection id="about" title="1. About Open Order">
        <p>
          Open Order is a pickup ordering platform that allows customers to order food and related items from
          participating vendors, including food carts and vendors located in food pods.
        </p>
        <p>
          Open Order may help facilitate ordering, checkout, payment processing, order routing, pickup
          coordination, and customer notifications. Participating vendors are responsible for preparing the
          food or items they sell through the platform.
        </p>
      </LegalSection>

      <LegalSection id="eligibility" title="2. Eligibility">
        <p>
          You must be at least 13 years old to use Open Order. By using Open Order, you represent that you
          are legally able to enter into these Terms.
        </p>
        <p>
          If you use Open Order on behalf of a business or organization, you represent that you have
          authority to bind that business or organization to these Terms.
        </p>
      </LegalSection>

      <LegalSection id="accounts" title="3. Accounts">
        <p>
          You may need an account to use certain features. You agree to provide accurate information and keep
          your account information current.
        </p>
        <p>
          You are responsible for maintaining the confidentiality of your login credentials and for all
          activity under your account.
        </p>
        <p>
          Open Order may suspend or terminate accounts that violate these Terms, create risk, abuse the
          platform, or interfere with service operations.
        </p>
      </LegalSection>

      <LegalSection id="orders" title="4. Orders">
        <p>
          When you place an order through Open Order, you agree to pay the full amount shown at checkout,
          including applicable item prices, taxes, fees, and tips.
        </p>
        <p>
          Orders are subject to vendor availability, item availability, operating hours, and successful
          payment authorization.
        </p>
        <p>
          Open Order and participating vendors may cancel or reject orders due to unavailable items, payment
          issues, suspected fraud, operational issues, or other reasonable causes.
        </p>
      </LegalSection>

      <LegalSection id="pickup" title="5. Pickup">
        <p>Open Order is currently intended for pickup orders unless otherwise stated.</p>
        <p>
          You are responsible for reviewing the pickup location, estimated timing, pickup instructions, and
          pickup code.
        </p>
        <p>
          Food quality, preparation timing, and item availability may vary by vendor. Open Order may provide
          estimated times, but estimated times are not guaranteed.
        </p>
      </LegalSection>

      <LegalSection id="payments" title="6. Payments, Fees, and Tips">
        <p>
          Payments are processed by third-party payment processors. By placing an order, you authorize the
          applicable payment processor to charge your selected payment method.
        </p>
        <p>Open Order may charge service fees, platform fees, or other fees shown at checkout.</p>
        <p>
          Tips are intended for participating vendors or vendor staff according to Open Order’s applicable tip
          allocation process.
        </p>
        <p>All prices and fees are shown before purchase and may change over time.</p>
      </LegalSection>

      <LegalSection id="cancellations" title="7. Cancellations, Refunds, and Issues">
        <p>
          Refund eligibility depends on the circumstances of the order, vendor status, payment status, and
          applicable policies.
        </p>
        <p>
          Open Order may issue full or partial refunds at its discretion or as required by law. Refund timing
          may depend on payment processor and bank processing timelines.
        </p>
        <p>
          If there is an issue with your order, you should report it through the order page or support channel
          as soon as possible.
        </p>
      </LegalSection>

      <LegalSection id="text-messages" title="8. Text Message Notifications">
        <p>
          By providing your phone number and opting in, you agree to receive transactional SMS messages
          from Open Order. These messages may include verification codes, order received confirmations,
          order preparing updates, ready-for-pickup alerts, cancellation notices, and order issue
          notifications.
        </p>
        <p>
          Message frequency varies based on account activity and order activity. Message and data rates
          may apply. Carriers are not liable for delayed or undelivered messages.
        </p>
        <p>
          You can opt out at any time by replying <strong className="text-oo-charcoal">STOP</strong> to
          any Open Order SMS message. After you opt out, you may no longer receive SMS updates related to
          your orders unless you opt in again. You can reply{" "}
          <strong className="text-oo-charcoal">HELP</strong> for help or contact Open Order at{" "}
          <a
            href={`mailto:${OPEN_ORDER_SUPPORT_EMAIL}`}
            className="font-semibold text-brand hover:underline"
          >
            {OPEN_ORDER_SUPPORT_EMAIL}
          </a>
          .
        </p>
        <p className="rounded-lg border border-brand/20 bg-oo-cream/80 px-4 py-3 font-medium text-oo-charcoal">
          Open Order does not send marketing or promotional SMS messages under this transactional messaging
          program.
        </p>
        <p>
          See our{" "}
          <Link href="/sms-consent" className="font-semibold text-brand hover:underline">
            SMS Messaging Consent
          </Link>{" "}
          page for where customers opt in and the exact consent language used in the app.
        </p>
      </LegalSection>

      <LegalSection id="email" title="9. Email Notifications">
        <p>
          Open Order may send transactional emails related to your account, orders, receipts, refunds, support
          requests, policy updates, and service operations.
        </p>
        <p>
          You may opt out of non-transactional emails where applicable, but we may still send important
          transactional or service-related emails.
        </p>
      </LegalSection>

      <LegalSection id="conduct" title="10. User Conduct">
        <p>You agree not to:</p>
        <LegalList
          items={[
            "Use Open Order for unlawful purposes",
            "Submit false, misleading, or fraudulent information",
            "Interfere with platform operation or security",
            "Attempt to access another user’s account",
            "Abuse refunds, promotions, credits, or order issue systems",
            "Harass vendors, customers, pod operators, or Open Order personnel",
            "Reverse engineer, scrape, or misuse the platform",
            "Upload malicious code or attempt to disrupt the service",
          ]}
        />
      </LegalSection>

      <LegalSection id="vendor-responsibility" title="11. Vendor Responsibility">
        <p>
          Participating vendors are responsible for preparing orders, setting menu availability, maintaining
          accurate item information where applicable, and complying with food safety, licensing, tax, and
          business obligations.
        </p>
        <p>
          Open Order is not responsible for the acts, omissions, food preparation practices, ingredient
          handling, allergen practices, or food safety practices of independent vendors.
        </p>
        <p>
          Customers with allergies or dietary restrictions should contact the vendor directly or avoid
          ordering items where safety cannot be confirmed.
        </p>
      </LegalSection>

      <LegalSection id="availability" title="12. Platform Availability">
        <p>
          Open Order may be unavailable from time to time due to maintenance, outages, vendor system issues,
          payment processor issues, internet problems, or other causes.
        </p>
        <p>We do not guarantee uninterrupted or error-free service.</p>
      </LegalSection>

      <LegalSection id="promotions" title="13. Promotions and Credits">
        <p>
          Open Order may offer promotions, discounts, or credits. These may be subject to additional terms,
          expiration dates, availability limits, and eligibility requirements.
        </p>
        <p>
          Open Order may modify, suspend, or cancel promotions at any time, subject to applicable law.
        </p>
      </LegalSection>

      <LegalSection id="ip" title="14. Intellectual Property">
        <p>
          Open Order’s website, software, design, branding, logos, content, and related materials are owned
          by Open Order or its licensors and are protected by applicable intellectual property laws.
        </p>
        <p>You may not copy, modify, distribute, sell, or exploit Open Order materials without permission.</p>
      </LegalSection>

      <LegalSection id="privacy" title="15. Privacy">
        <p>
          Your use of Open Order is also governed by our{" "}
          <Link href="/privacy" className="font-semibold text-brand hover:underline">
            Privacy Policy
          </Link>
          , which explains how we collect, use, and protect information.
        </p>
      </LegalSection>

      <LegalSection id="disclaimers" title="16. Disclaimers">
        <p>Open Order is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis.</p>
        <p>
          To the fullest extent permitted by law, Open Order disclaims warranties of any kind, whether
          express, implied, or statutory, including warranties of merchantability, fitness for a particular
          purpose, title, and non-infringement.
        </p>
      </LegalSection>

      <LegalSection id="liability" title="17. Limitation of Liability">
        <p>
          To the fullest extent permitted by law, Open Order will not be liable for indirect, incidental,
          special, consequential, exemplary, or punitive damages, including lost profits, lost data, or
          business interruption.
        </p>
        <p>
          To the fullest extent permitted by law, Open Order’s total liability for any claim related to the
          service will not exceed the amount you paid to Open Order for the order giving rise to the claim.
        </p>
        <p>
          Some jurisdictions do not allow certain limitations, so some of the above limitations may not apply
          to you.
        </p>
      </LegalSection>

      <LegalSection id="indemnification" title="18. Indemnification">
        <p>
          You agree to defend, indemnify, and hold harmless Open Order and its owners, employees,
          contractors, partners, vendors, and service providers from claims, damages, liabilities, costs, and
          expenses arising from your use of Open Order, your violation of these Terms, your misuse of the
          service, or your violation of law.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="19. Changes to These Terms">
        <p>
          We may update these Terms from time to time. If we make material changes, we will update the
          effective date and may provide additional notice.
        </p>
        <p>
          Your continued use of Open Order after updated Terms become effective means you accept the updated
          Terms.
        </p>
      </LegalSection>

      <LegalSection id="governing-law" title="20. Governing Law">
        <p>
          These Terms are governed by the laws of the State of Oregon, without regard to conflict of law
          principles, unless applicable law requires otherwise.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="21. Contact">
        <p>For questions about these Terms, contact us at:</p>
        <address className="not-italic">
          <p className="font-semibold text-oo-charcoal">Open Order</p>
          <p>
            Email:{" "}
            <a
              href={`mailto:${OPEN_ORDER_SUPPORT_EMAIL}`}
              className="font-semibold text-brand hover:underline"
            >
              {OPEN_ORDER_SUPPORT_EMAIL}
            </a>
          </p>
          <p className="mt-2">{LEGAL_MAILING_ADDRESS_NOTICE}</p>
        </address>
        <p className="mt-4">
          Related:{" "}
          <Link href="/privacy" className="font-semibold text-brand hover:underline">
            Privacy Policy
          </Link>
        </p>
      </LegalSection>
    </LegalDocumentPage>
  );
}

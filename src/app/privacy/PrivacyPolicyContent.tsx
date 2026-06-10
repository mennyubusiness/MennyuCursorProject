import Link from "next/link";

import { LegalDocumentPage } from "@/components/legal/LegalDocumentPage";
import { LegalList, LegalSection, LegalSubheading } from "@/components/legal/LegalSection";
import {
  LEGAL_MAILING_ADDRESS_NOTICE,
  OPEN_ORDER_SUPPORT_EMAIL,
} from "@/lib/legal/constants";

export function PrivacyPolicyContent() {
  return (
    <LegalDocumentPage
      title="Privacy Policy"
      intro={
        <>
          <p>
            Open Order (&ldquo;Open Order,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;)
            respects your privacy. This Privacy Policy explains how we collect, use, disclose, and protect
            information when you use our website, ordering platform, text messaging services, and related
            services.
          </p>
          <p>
            By using Open Order, you agree to the collection and use of information described in this Privacy
            Policy.
          </p>
        </>
      }
    >
      <LegalSection id="information-we-collect" title="1. Information We Collect">
        <p>We may collect the following types of information:</p>
        <LegalSubheading>Account and Contact Information</LegalSubheading>
        <p>When you create an account, place an order, or interact with Open Order, we may collect:</p>
        <LegalList
          items={[
            "Name",
            "Email address",
            "Phone number",
            "Account login information",
            "Order history",
            "Pickup information",
            "Customer support communications",
          ]}
        />
        <LegalSubheading>Order and Transaction Information</LegalSubheading>
        <p>When you place an order, we may collect:</p>
        <LegalList
          items={[
            "Items ordered",
            "Vendor or food cart selected",
            "Food pod or pickup location",
            "Order status",
            "Pickup code",
            "Payment status",
            "Refund or cancellation information",
            "Special instructions you provide with your order",
          ]}
        />
        <LegalSubheading>Payment Information</LegalSubheading>
        <p>
          Payments are processed by third-party payment processors, such as Stripe. Open Order does not store
          your full payment card number. Payment processors may collect and process your payment information
          according to their own privacy policies and terms.
        </p>
        <LegalSubheading>Device and Usage Information</LegalSubheading>
        <p>We may collect information about how you access and use Open Order, including:</p>
        <LegalList
          items={[
            "IP address",
            "Browser type",
            "Device type",
            "Operating system",
            "Pages viewed",
            "Referring pages",
            "Approximate location based on device or browser data",
            "Log data and diagnostic information",
          ]}
        />
        <LegalSubheading>Text Messaging Information</LegalSubheading>
        <p>
          If you provide your phone number and agree to receive text messages, we may collect and use your
          phone number to send transactional SMS notifications, including:
        </p>
        <LegalList
          items={[
            "Phone verification codes",
            "Order confirmations",
            "Order status updates",
            "Pickup-ready alerts",
            "Cancellation notices",
            "Order issue notifications",
          ]}
        />
        <p className="font-medium text-oo-charcoal">
          We do not use transactional SMS consent for marketing messages unless you separately opt in to
          marketing communications.
        </p>
      </LegalSection>

      <LegalSection id="how-we-use" title="2. How We Use Information">
        <p>We use information to:</p>
        <LegalList
          items={[
            "Create and manage accounts",
            "Process pickup orders",
            "Route orders to participating vendors",
            "Provide order status updates",
            "Send verification codes",
            "Send transactional text messages and emails",
            "Process payments, refunds, and cancellations",
            "Provide customer support",
            "Improve Open Order’s website, checkout, and vendor systems",
            "Prevent fraud, abuse, and unauthorized activity",
            "Maintain security and reliability",
            "Comply with legal, tax, regulatory, and operational requirements",
          ]}
        />
      </LegalSection>

      <LegalSection id="text-message-privacy" title="3. Text Message Privacy">
        <p>
          OpenOrder may collect your mobile phone number when you create an account, verify your phone
          number, place an order, or request transactional order updates.
        </p>
        <p>
          OpenOrder uses mobile phone numbers and SMS consent only to provide transactional messages
          related to OpenOrder services, including verification codes, order confirmations, order status
          updates, pickup-ready alerts, cancellation notices, and order issue notices.
        </p>
        <p>
          Message frequency varies. Message and data rates may apply. You may opt out of SMS messages at
          any time by replying <strong className="text-oo-charcoal">STOP</strong>. You may reply{" "}
          <strong className="text-oo-charcoal">HELP</strong> for help or contact OpenOrder at{" "}
          <a
            href={`mailto:${OPEN_ORDER_SUPPORT_EMAIL}`}
            className="font-semibold text-brand hover:underline"
          >
            {OPEN_ORDER_SUPPORT_EMAIL}
          </a>
          .
        </p>
        <p className="rounded-lg border border-brand/20 bg-oo-cream/80 px-4 py-3 font-medium text-oo-charcoal">
          OpenOrder does not sell, rent, share, or transfer mobile phone numbers, SMS opt-in data, or SMS
          consent information to third parties or affiliates for marketing or promotional purposes. SMS
          opt-in data and consent are used only to provide transactional messaging related to OpenOrder
          services.
        </p>
        <p>
          We may share phone numbers with service providers, such as SMS delivery providers, only as
          necessary to send transactional messages, operate the service, detect abuse, or comply with
          legal obligations.
        </p>
        <p>
          See also our{" "}
          <Link href="/sms-consent" className="font-semibold text-brand hover:underline">
            SMS Messaging Consent
          </Link>{" "}
          page for opt-in locations and checkbox language.
        </p>
      </LegalSection>

      <LegalSection id="how-we-share" title="4. How We Share Information">
        <p>We may share information with:</p>
        <LegalSubheading>Vendors and Food Carts</LegalSubheading>
        <p>
          We share order details with the vendor or food cart responsible for preparing your order. This may
          include your name, order items, pickup code, and special instructions.
        </p>
        <LegalSubheading>Pod Operators</LegalSubheading>
        <p>
          We may share limited operational information with food pod operators, such as aggregated order
          activity, issue reports, or pickup-related information.
        </p>
        <LegalSubheading>Service Providers</LegalSubheading>
        <p>We may share information with companies that help us operate Open Order, including:</p>
        <LegalList
          items={[
            "Payment processors",
            "SMS providers",
            "Email providers",
            "Hosting providers",
            "Analytics providers",
            "Fraud prevention providers",
            "Customer support tools",
          ]}
        />
        <p>These providers are only authorized to use information as needed to provide services to Open Order.</p>
        <LegalSubheading>Legal and Safety Reasons</LegalSubheading>
        <p>We may disclose information if required to do so by law or if we believe disclosure is necessary to:</p>
        <LegalList
          items={[
            "Comply with legal obligations",
            "Enforce our Terms of Service",
            "Protect Open Order, customers, vendors, or the public",
            "Detect, prevent, or address fraud, security, or technical issues",
          ]}
        />
        <LegalSubheading>Business Transfers</LegalSubheading>
        <p>
          If Open Order is involved in a merger, acquisition, financing, reorganization, sale of assets, or
          similar transaction, information may be transferred as part of that transaction.
        </p>
      </LegalSection>

      <LegalSection id="cookies" title="5. Cookies and Similar Technologies">
        <p>We may use cookies and similar technologies to:</p>
        <LegalList
          items={[
            "Keep users signed in",
            "Remember preferences",
            "Improve site performance",
            "Understand usage patterns",
            "Prevent fraud and abuse",
          ]}
        />
        <p>
          You may control cookies through your browser settings. Some features may not work properly if
          cookies are disabled.
        </p>
      </LegalSection>

      <LegalSection id="data-security" title="6. Data Security">
        <p>
          We use reasonable administrative, technical, and organizational measures to protect information.
          However, no internet service, website, or electronic storage system is completely secure. We
          cannot guarantee absolute security.
        </p>
      </LegalSection>

      <LegalSection id="data-retention" title="7. Data Retention">
        <p>
          We keep information for as long as reasonably necessary to provide Open Order, complete
          transactions, comply with legal obligations, resolve disputes, enforce agreements, and maintain
          business records.
        </p>
        <p>
          Order, payment, support, and compliance records may be retained for longer periods where required
          or appropriate.
        </p>
      </LegalSection>

      <LegalSection id="your-choices" title="8. Your Choices">
        <p>Depending on your location and applicable law, you may have rights to:</p>
        <LegalList
          items={[
            "Access personal information we hold about you",
            "Correct inaccurate information",
            "Request deletion of certain information",
            "Opt out of certain communications",
            "Withdraw SMS consent by replying STOP",
            "Request information about how your data is used",
          ]}
        />
        <p>
          To make a request, contact us at:{" "}
          <a
            href={`mailto:${OPEN_ORDER_SUPPORT_EMAIL}`}
            className="font-semibold text-brand hover:underline"
          >
            {OPEN_ORDER_SUPPORT_EMAIL}
          </a>
        </p>
      </LegalSection>

      <LegalSection id="children" title="9. Children’s Privacy">
        <p>
          Open Order is not intended for children under 13. We do not knowingly collect personal information
          from children under 13. If we learn that we collected information from a child under 13, we will
          take reasonable steps to delete it.
        </p>
      </LegalSection>

      <LegalSection id="third-party" title="10. Third-Party Links and Services">
        <p>
          Open Order may contain links to third-party websites or services, including payment processors,
          vendors, or food pod websites. We are not responsible for the privacy practices of those third
          parties.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="11. Changes to This Privacy Policy">
        <p>
          We may update this Privacy Policy from time to time. If we make material changes, we will update
          the effective date and may provide additional notice where appropriate.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="12. Contact Us">
        <p>For questions about this Privacy Policy or our privacy practices, contact us at:</p>
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
          <Link href="/terms" className="font-semibold text-brand hover:underline">
            Terms of Service
          </Link>
        </p>
      </LegalSection>
    </LegalDocumentPage>
  );
}

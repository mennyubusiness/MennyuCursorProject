import type { Metadata } from "next";

import { SmsConsentPageContent } from "./SmsConsentPageContent";

export const metadata: Metadata = {
  title: "SMS Messaging Consent | Open Order",
  description:
    "How OpenOrder collects SMS consent for transactional order and account messages only.",
};

export default function SmsConsentPage() {
  return <SmsConsentPageContent />;
}

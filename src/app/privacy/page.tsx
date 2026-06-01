import type { Metadata } from "next";

import { PrivacyPolicyContent } from "./PrivacyPolicyContent";

export const metadata: Metadata = {
  title: "Privacy Policy | Open Order",
  description:
    "How Open Order collects, uses, and protects your information — including transactional SMS for order updates and pickup notifications.",
};

export default function PrivacyPolicyPage() {
  return <PrivacyPolicyContent />;
}

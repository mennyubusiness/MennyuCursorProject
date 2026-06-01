import type { Metadata } from "next";

import { TermsOfServiceContent } from "./TermsOfServiceContent";

export const metadata: Metadata = {
  title: "Terms of Service | Open Order",
  description:
    "Terms for using Open Order’s pickup ordering platform, including accounts, orders, payments, and transactional SMS notifications.",
};

export default function TermsOfServicePage() {
  return <TermsOfServiceContent />;
}

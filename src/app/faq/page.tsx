import type { Metadata } from "next";

import { FaqPageContent } from "./FaqPageContent";

export const metadata: Metadata = {
  title: "FAQ | Open Order",
  description: "Common questions about Open Order for pod owners, vendors, and guests.",
};

export default function FaqPage() {
  return <FaqPageContent />;
}

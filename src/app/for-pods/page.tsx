import type { Metadata } from "next";

import { ForPodsPageContent } from "./ForPodsPageContent";

export const metadata: Metadata = {
  title: "For Pods | Open Order",
  description:
    "Give your food pod one QR code, one ordering experience, multiple vendors, one checkout, and one pickup flow.",
};

export default function ForPodsPage() {
  return <ForPodsPageContent />;
}

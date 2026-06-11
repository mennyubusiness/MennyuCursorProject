import type { Metadata } from "next";

import { AboutPageContent } from "./AboutPageContent";

export const metadata: Metadata = {
  title: "About | Open Order",
  description:
    "Open Order is a connected ordering system for food pods — one QR code, multiple vendors, one checkout, one pickup flow.",
};

export default function AboutPage() {
  return <AboutPageContent />;
}

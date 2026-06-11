import Link from "next/link";

import { MarketingDocumentPage } from "@/components/marketing/MarketingDocumentPage";
import { ButtonLink } from "@/components/ui/button";

export function AboutPageContent() {
  return (
    <MarketingDocumentPage
      title="About Open Order"
      intro={
        <>
          <p>
            Open Order is a connected ordering system for food pods. We help guests scan one QR code,
            order from multiple vendors, pay once, and follow pickup from one place — without splitting
            groups across separate lines and checkouts.
          </p>
          <p>
            We work with pod owners who want their location to feel like one experience, vendors who want
            more orders without operational chaos, and guests who just want ordering to be simple.
          </p>
        </>
      }
    >
      <section className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight text-oo-charcoal">What we believe</h2>
        <p className="leading-relaxed text-oo-stone-gray">
          Food pods are social places. When ordering is fragmented, the pod feels fragmented too. Open
          Order exists to keep the energy of the pod intact while making operations clearer for owners
          and vendors.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight text-oo-charcoal">Who we serve</h2>
        <ul className="list-disc space-y-2 pl-5 leading-relaxed text-oo-stone-gray">
          <li>Pod owners building a more connected guest experience</li>
          <li>Vendors serving inside multi-vendor food pods</li>
          <li>Guests ordering together from their phones</li>
        </ul>
      </section>

      <section className="flex flex-col gap-4 border-t border-oo-light-stone pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-oo-stone-gray">
          Running a pod?{" "}
          <Link href="/for-pods" className="font-semibold text-brand hover:underline">
            See how Open Order works for pods
          </Link>
          .
        </p>
        <ButtonLink href="/for-pods" variant="secondary" size="sm">
          For Pods
        </ButtonLink>
      </section>
    </MarketingDocumentPage>
  );
}

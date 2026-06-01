import Link from "next/link";
import type { ReactNode } from "react";

import { PageShell } from "@/components/layout/page-shell";
import { LEGAL_EFFECTIVE_DATE } from "@/lib/legal/constants";

type LegalDocumentPageProps = {
  title: string;
  intro: ReactNode;
  children: ReactNode;
};

export function LegalDocumentPage({ title, intro, children }: LegalDocumentPageProps) {
  return (
    <div className="min-h-[calc(100dvh-4.25rem)] bg-[#EDE6DC] py-8 sm:py-12 lg:py-14">
      <PageShell width="tight">
        <article className="rounded-xl border border-oo-light-stone bg-oo-warm-white px-6 py-8 shadow-[0_6px_28px_-10px_rgba(31,31,28,0.12)] sm:px-10 sm:py-10 lg:px-12 lg:py-12">
          <header className="border-b border-oo-light-stone pb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Open Order</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-oo-charcoal sm:text-4xl">
              {title}
            </h1>
            <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-oo-stone-gray">
              <div>
                <dt className="sr-only">Effective date</dt>
                <dd>
                  <span className="font-medium text-oo-charcoal">Effective date:</span>{" "}
                  {LEGAL_EFFECTIVE_DATE}
                </dd>
              </div>
              <div>
                <dt className="sr-only">Last updated</dt>
                <dd>
                  <span className="font-medium text-oo-charcoal">Last updated:</span>{" "}
                  {LEGAL_EFFECTIVE_DATE}
                </dd>
              </div>
            </dl>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-oo-stone-gray">{intro}</div>
          </header>

          <div className="legal-document-body mt-10 space-y-10">{children}</div>

          <footer className="mt-12 border-t border-oo-light-stone pt-8 text-sm text-oo-stone-gray">
            <p>
              See also{" "}
              <Link href="/terms" className="font-semibold text-brand hover:underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="font-semibold text-brand hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </footer>
        </article>
      </PageShell>
    </div>
  );
}

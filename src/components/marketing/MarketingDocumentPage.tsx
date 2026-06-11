import type { ReactNode } from "react";

import { PageShell } from "@/components/layout/page-shell";

type MarketingDocumentPageProps = {
  eyebrow?: string;
  title: string;
  intro: ReactNode;
  children: ReactNode;
};

export function MarketingDocumentPage({
  eyebrow = "Open Order",
  title,
  intro,
  children,
}: MarketingDocumentPageProps) {
  return (
    <div className="min-h-[calc(100dvh-4.25rem)] bg-[#EDE6DC] py-8 sm:py-12 lg:py-14">
      <PageShell width="tight">
        <article className="rounded-xl border border-oo-light-stone bg-oo-warm-white px-6 py-8 shadow-[0_6px_28px_-10px_rgba(31,31,28,0.12)] sm:px-10 sm:py-10 lg:px-12 lg:py-12">
          <header className="border-b border-oo-light-stone pb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">{eyebrow}</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-oo-charcoal sm:text-4xl">
              {title}
            </h1>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-oo-stone-gray">{intro}</div>
          </header>
          <div className="mt-10 space-y-10">{children}</div>
        </article>
      </PageShell>
    </div>
  );
}

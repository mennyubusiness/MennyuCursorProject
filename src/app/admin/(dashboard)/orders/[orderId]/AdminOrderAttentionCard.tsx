"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AdminOrderHealthState } from "@/lib/admin-order-health";
import { ADMIN_SECTION_CARD } from "@/lib/admin-order-detail-ui";
import { VendorClawbackReviewActions } from "@/components/admin/VendorClawbackReviewActions";

export function AdminOrderAttentionCard({ health }: { health: AdminOrderHealthState }) {
  const router = useRouter();
  const isOk = health.status === "ok";
  const isNeutral = !isOk && health.tone === "neutral";

  return (
    <section
      className={`${ADMIN_SECTION_CARD} ${
        isOk
          ? "border-emerald-200/80 bg-emerald-50/30"
          : isNeutral
            ? "border-sky-200/80 bg-sky-50/30"
            : "border-amber-300/80 bg-amber-50/40"
      }`}
      aria-labelledby="order-attention-heading"
    >
      <h2 id="order-attention-heading" className="text-sm font-semibold text-oo-charcoal">
        What needs attention?
      </h2>
      <p
        className={`mt-2 text-base font-semibold ${
          isOk ? "text-emerald-950" : isNeutral ? "text-sky-950" : "text-amber-950"
        }`}
      >
        {health.title}
      </p>
      <p className="mt-1 max-w-3xl text-sm leading-relaxed text-oo-charcoal">{health.explanation}</p>
      {health.secondaryNotes?.map((note) => (
        <p key={note} className="mt-1 text-xs text-oo-stone-gray">
          {note}
        </p>
      ))}
      {health.financialReview ? (
        <div className="mt-4 max-w-xl">
          <VendorClawbackReviewActions
            vendorPayoutTransferId={health.financialReview.vendorPayoutTransferId}
            stripeTransferId={health.financialReview.stripeTransferId}
            needsReview={health.financialReview.review.needsReview}
            review={health.financialReview.review}
            reviewKind={health.financialReview.reviewKind}
            onComplete={() => router.refresh()}
          />
        </div>
      ) : null}
      {health.actions.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {health.actions.map((action) => (
            <Link
              key={`${action.href}:${action.label}`}
              href={action.href}
              className={
                action.primary
                  ? "rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-hover"
                  : "rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm font-medium text-oo-charcoal hover:bg-oo-cream"
              }
            >
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}

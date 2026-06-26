import Link from "next/link";

import { DashboardCard } from "@/components/dashboard";
import type { ReadinessChecklistItem } from "@/lib/vendor-pod-readiness";

export function PodReadinessPromotionSection({
  podId,
  promotionItem,
}: {
  podId: string;
  promotionItem: ReadinessChecklistItem | null;
}) {
  if (!promotionItem) return null;

  return (
    <DashboardCard
      title="Promotion tools"
      description="Optional tools to help customers find your pod. These do not affect whether customers can order."
      as="section"
      variant="muted"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-oo-charcoal">{promotionItem.label}</p>
          <p className="mt-1 text-sm text-oo-stone-gray">{promotionItem.description}</p>
        </div>
        <Link
          href={promotionItem.actionHref ?? `/pod/${podId}/promote`}
          className="inline-flex shrink-0 rounded-lg border border-oo-light-stone bg-oo-warm-white px-4 py-2 text-sm font-medium text-oo-charcoal hover:bg-oo-cream"
        >
          {promotionItem.actionLabel ?? "Open Promote"}
        </Link>
      </div>
    </DashboardCard>
  );
}

import { getAttentionItems, partitionAttentionItemsForWorkbench } from "@/lib/admin-attention";
import { prisma } from "@/lib/db";
import { getAdminLegacyClawbackReviewHistory } from "@/services/legacy-clawback-review.service";
import { getAdminResolvedIssueHistory } from "@/services/issues.service";
import { IssuesWorkbench } from "./IssuesWorkbench";

export default async function AdminExceptionsPage() {
  const [allAttentionItems, resolvedHistory, legacyReviewHistory, pods] = await Promise.all([
    getAttentionItems(),
    getAdminResolvedIssueHistory(200),
    getAdminLegacyClawbackReviewHistory(200),
    prisma.pod.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const { currentNeedsAttention, legacyFinancialReview } =
    partitionAttentionItemsForWorkbench(allAttentionItems);
  const mergedResolvedHistory = [
    ...resolvedHistory,
    ...legacyReviewHistory.map((r) => ({
      id: r.id,
      kind: r.kind,
      orderId: r.orderId,
      resolvedAt: r.resolvedAt,
      type: `legacy_clawback_${r.status}`,
      severity: "LOW",
      notes: r.notes,
      podName: r.podName,
      podId: r.podId,
      vendorName: r.vendorName,
    })),
  ].sort((a, b) => new Date(b.resolvedAt).getTime() - new Date(a.resolvedAt).getTime());

  return (
    <div>
      <h1 className="text-xl font-semibold text-oo-charcoal">Issues</h1>
      <p className="mt-1 max-w-2xl text-sm text-oo-stone-gray">
        Active queue for routing, fulfillment, refunds, and tracked issues. Historical clawback cases with incomplete
        refund linkage are listed separately under Legacy Financial Review. Resolve on the order page for full controls.
      </p>

      <IssuesWorkbench
        initialCurrentItems={currentNeedsAttention}
        initialLegacyItems={legacyFinancialReview}
        resolvedHistory={mergedResolvedHistory}
        pods={pods}
      />
    </div>
  );
}

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { partitionAttentionItemsForWorkbench } from "@/lib/admin-attention";
import type { AdminAttentionItem } from "@/lib/admin-attention";

const dir = dirname(fileURLToPath(import.meta.url));
const attentionSrc = readFileSync(join(dir, "admin-attention.ts"), "utf8");
const workbenchSrc = readFileSync(
  join(dir, "../app/admin/(dashboard)/exceptions/IssuesWorkbench.tsx"),
  "utf8"
);

function item(reason: AdminAttentionItem["reason"]): AdminAttentionItem {
  return {
    id: `test:${reason}`,
    scope: "vendor_order",
    reason,
    bucket: "financial_resolution",
    severity: reason === "legacy_clawback_review" ? "low" : "high",
    ageMinutes: 10,
    recommendedAction: "review_manually",
    reasonLabel: "test",
    currentStatus: "test",
    orderId: "ord_1",
    primaryEntityHref: "/admin/orders/ord_1",
  };
}

describe("admin-attention legacy clawback", () => {
  it("skips reviewed/deferred legacy transfers when building queue", () => {
    expect(attentionSrc).toMatch(/isLegacyClawbackReviewClosed/);
    expect(attentionSrc).toMatch(/legacyClawbackReviewStatus/);
    expect(attentionSrc).toMatch(/assessRefundEvidenceForReversalPrep/);
  });

  it("partitions legacy items out of current needs attention", () => {
    const { currentNeedsAttention, legacyFinancialReview } = partitionAttentionItemsForWorkbench([
      item("vendor_clawback_missing"),
      item("legacy_clawback_review"),
      item("refund_failed"),
    ]);
    expect(currentNeedsAttention.map((i) => i.reason)).toEqual([
      "vendor_clawback_missing",
      "refund_failed",
    ]);
    expect(legacyFinancialReview).toHaveLength(1);
    expect(legacyFinancialReview[0]?.reason).toBe("legacy_clawback_review");
  });

  it("workbench shows separate legacy financial review section", () => {
    expect(workbenchSrc).toMatch(/Legacy financial review/i);
    expect(workbenchSrc).toMatch(/Current needs attention/i);
    expect(workbenchSrc).toMatch(/Mark reviewed/);
    expect(workbenchSrc).toMatch(/item\.reason !== "legacy_clawback_review"/);
  });
});

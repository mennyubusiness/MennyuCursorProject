import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../../..");

describe("admin vendor transfers page terminology", () => {
  const pageSrc = readFileSync(
    join(root, "src/app/admin/(dashboard)/payout-transfers/page.tsx"),
    "utf8"
  );
  const dashboardSrc = readFileSync(
    join(root, "src/app/admin/(dashboard)/payout-transfers/PayoutTransfersDashboard.tsx"),
    "utf8"
  );
  const detailsSrc = readFileSync(
    join(root, "src/components/admin/VendorTransferRowDetails.tsx"),
    "utf8"
  );

  it("passes server-derived minimum balance cents from page to dashboard", () => {
    expect(pageSrc).toMatch(/getStripeRecommendedPlatformMinimumBalanceCents/);
    expect(pageSrc).toMatch(/recommendedMinimumBalanceCents=/);
    expect(dashboardSrc).toMatch(/recommendedMinimumBalanceCents: number/);
    expect(dashboardSrc).toMatch(/formatRecommendedPlatformMinimumBalanceLabel/);
  });

  it("passes balance error to dashboard so page still renders", () => {
    expect(pageSrc).toMatch(/fetchStripePlatformBalance/);
    expect(pageSrc).toMatch(/initialBalanceError/);
    expect(dashboardSrc).toMatch(/initialBalanceError/);
    expect(dashboardSrc).toMatch(/Unable to fetch Stripe balance/);
  });

  it("uses compact operational subtitle and keeps educational copy collapsed", () => {
    expect(dashboardSrc).toMatch(/Payouts/);
    expect(dashboardSrc).toMatch(/Vendor Connect transfers, pod revenue share payouts/);
    expect(dashboardSrc).toMatch(/How this works/);
    expect(dashboardSrc).toMatch(/stripe-platform-payout-config\.shared/);
    expect(dashboardSrc).toMatch(/ADMIN_VENDOR_AUTO_TRANSFER_WARNING/);
    expect(dashboardSrc).not.toMatch(/stripe-platform-payout-config\.server/);
    expect(dashboardSrc).not.toMatch(/ADMIN_VENDOR_TRANSFERS_BALANCE_NOTE[\s\S]{0,120}mt-4 max-w-3xl/);
  });

  it("renders compact summary metric labels by default", () => {
    expect(dashboardSrc).toMatch(/Needs action/);
    expect(dashboardSrc).toMatch(/Ready to send/);
    expect(dashboardSrc).toMatch(/>Blocked</);
    expect(dashboardSrc).toMatch(/>Sent</);
    expect(dashboardSrc).toMatch(/Stripe balance/);
    expect(dashboardSrc).toMatch(/Minimum:/);
    expect(dashboardSrc).not.toMatch(/Retryable \(failed \/ insufficient balance\)/);
    expect(dashboardSrc).not.toMatch(/Total vendor owed \(unsent\)/);
    expect(dashboardSrc).not.toMatch(/Recommended platform minimum balance/);
  });

  it("loads pod payout transfers for the unified admin payouts page", () => {
    expect(pageSrc).toMatch(/listPodPayoutTransfersForAdminDashboard/);
    expect(pageSrc).toMatch(/initialPodTransfers=/);
    expect(dashboardSrc).toMatch(/AdminPodPayoutTransfersSection/);
    expect(dashboardSrc).toMatch(/payoutCategoryTab/);
  });

  it("uses short primary action labels in the recommended order", () => {
    const actionsBlock = dashboardSrc.slice(
      dashboardSrc.indexOf("Retry eligible vendor transfers"),
      dashboardSrc.indexOf("More vendor actions")
    );
    const retryIdx = actionsBlock.indexOf("Retry eligible vendor transfers");
    const batchIdx = actionsBlock.indexOf("Run vendor batch");
    const refreshIdx = actionsBlock.indexOf("Refresh balance");
    expect(retryIdx).toBeGreaterThan(-1);
    expect(batchIdx).toBeGreaterThan(retryIdx);
    expect(refreshIdx).toBeGreaterThan(batchIdx);
    expect(actionsBlock).not.toMatch(/Reconcile with Stripe/);
    expect(dashboardSrc).toMatch(/More vendor actions/);
    expect(dashboardSrc).toMatch(/Reconcile vendor transfers with Stripe/);
    expect(dashboardSrc).not.toMatch(/Run vendor transfer batch/);
    expect(dashboardSrc).not.toMatch(/Retry all eligible vendor transfers/);
  });

  it("hides default row Check action and keeps Check Stripe in advanced actions", () => {
    expect(dashboardSrc).toMatch(/renderTransferAdvancedActions/);
    expect(dashboardSrc).toMatch(/Check Stripe/);
    expect(dashboardSrc).not.toMatch(/Retrying…" : "Check"/);
    expect(dashboardSrc).toMatch(/window\.confirm/);
  });

  it("renders Needs action table with Problem column and collapsed Details", () => {
    expect(dashboardSrc.indexOf("Vendor transfers — needs action")).toBeLessThan(
      dashboardSrc.indexOf("Vendor transfer history")
    );
    expect(dashboardSrc).toMatch(/>Problem</);
    expect(dashboardSrc).toMatch(/transferProblemLabel/);
    expect(dashboardSrc).toMatch(/transferStatusShortLabel/);
    expect(dashboardSrc).toMatch(/>\s*Details\s*</);
    expect(dashboardSrc).toMatch(/showBlockedNote=\{false\}/);
  });

  it("shows charge-linked badges without top-level source_transaction essays", () => {
    expect(dashboardSrc).toMatch(/transferFundingBadgeLabel/);
    expect(dashboardSrc).toMatch(/renderFundingBadge/);
    expect(dashboardSrc).not.toMatch(/ADMIN_VENDOR_TRANSFERS_BALANCE_NOTE[\s\S]{0,80}mt-4 max-w-3xl text-xs/);
  });

  it("collapses full transfer history by default", () => {
    expect(dashboardSrc).toMatch(/Vendor transfer history/);
    expect(dashboardSrc).toMatch(/historyOpen/);
  });

  it("keeps technical fields inside expanded row details", () => {
    expect(dashboardSrc).toMatch(/VendorTransferRowDetails/);
    expect(detailsSrc).toMatch(/Source transaction/);
    expect(detailsSrc).toMatch(/Transfer group/);
    expect(detailsSrc).toMatch(/Idempotency key/);
    expect(detailsSrc).toMatch(/Platform payout information/);
    expect(detailsSrc).not.toMatch(/Additional accounting context/);
  });

  it("preserves payout actions and retry controls", () => {
    expect(dashboardSrc).toMatch(/runPayoutBatch/);
    expect(dashboardSrc).toMatch(/runRetryAllPayouts/);
    expect(dashboardSrc).toMatch(/refreshBalance/);
    expect(dashboardSrc).toMatch(/runBulkReconcile/);
    expect(dashboardSrc).toMatch(/runRecheckBlockedTransfers/);
    expect(dashboardSrc).toMatch(/adminRetryVendorPayoutTransferAction/);
    expect(dashboardSrc).toMatch(/Retrying…" : "Retry"/);
    expect(dashboardSrc).toMatch(/updatedFromStripe/);
    expect(dashboardSrc).toMatch(/Beta payout runbook/);
    expect(dashboardSrc).toMatch(/ADMIN_PAYOUT_BETA_RUNBOOK/);
  });

  it("wires pod retry and reconcile actions in pod section", () => {
    const podSectionSrc = readFileSync(
      join(root, "src/app/admin/(dashboard)/payout-transfers/AdminPodPayoutTransfersSection.tsx"),
      "utf8"
    );
    expect(podSectionSrc).toMatch(/adminRetryPodPayoutTransferAction/);
    expect(podSectionSrc).toMatch(/adminReconcilePodPayoutTransferAction/);
    expect(podSectionSrc).toMatch(/Check Stripe/);
  });
});

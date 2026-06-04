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

  it("passes balance error to dashboard so page still renders", () => {
    expect(pageSrc).toMatch(/fetchStripePlatformBalance/);
    expect(pageSrc).toMatch(/initialBalanceError/);
    expect(dashboardSrc).toMatch(/initialBalanceError/);
    expect(dashboardSrc).toMatch(/Unable to fetch Stripe balance/);
  });

  it("uses Vendor Transfers title and operational intro copy", () => {
    expect(pageSrc).toMatch(/Vendor Transfers/);
    expect(pageSrc).toMatch(/Send vendor Connect transfers and monitor vendor clawbacks/);
    expect(pageSrc).toMatch(/ADMIN_VENDOR_TRANSFERS_PAGE_INTRO/);
    expect(pageSrc).not.toMatch(/Payout transfers/);
  });

  it("shows no actions needed message when action totals are zero", () => {
    expect(dashboardSrc).toMatch(/No vendor transfer actions needed right now/);
    expect(dashboardSrc).toMatch(/actionItemCount === 0/);
  });

  it("renders Needs action section before transfer history", () => {
    expect(dashboardSrc).toMatch(/Needs action/);
    expect(dashboardSrc.indexOf("Needs action")).toBeLessThan(
      dashboardSrc.indexOf("Transfer history")
    );
    expect(dashboardSrc).toMatch(/No vendor transfers or clawbacks need action/);
    expect(dashboardSrc).toMatch(/transferNeedsAction/);
  });

  it("shows recently sent section separate from needs action", () => {
    expect(dashboardSrc).toMatch(/Recently sent to vendors/);
    expect(dashboardSrc).toMatch(/RECENTLY_SENT_TRANSFER_LIMIT/);
    expect(dashboardSrc).toMatch(/isRecentlySentTransfer/);
  });

  it("puts cancelled transfers in collapsible section", () => {
    expect(dashboardSrc).toMatch(/Cancelled vendor transfers/);
    expect(dashboardSrc).toMatch(/customer was refunded first/);
    expect(dashboardSrc).toMatch(/sectionData\.cancelled\.length > 0/);
  });

  it("disables batch and retry when nothing eligible", () => {
    expect(dashboardSrc).toMatch(/batchDisabled/);
    expect(dashboardSrc).toMatch(/No vendor transfers are ready to send/);
    expect(dashboardSrc).toMatch(/retryAllDisabled/);
    expect(dashboardSrc).toMatch(/No blocked or failed transfers are retryable/);
  });

  it("moves reversal batch near clawback section with disabled copy", () => {
    expect(dashboardSrc).toMatch(/reversalBatchDisabled/);
    expect(dashboardSrc).toMatch(/No prepared vendor reversals are pending/);
    const clawbackSection = dashboardSrc.indexOf("Vendor clawbacks / transfer reversals");
    expect(dashboardSrc.indexOf("Run reversal batch", clawbackSection)).toBeGreaterThan(
      clawbackSection
    );
    expect(dashboardSrc).not.toMatch(
      /Run vendor transfer batch[\s\S]{0,800}Run reversal batch/
    );
  });

  it("collapses full transfer history by default", () => {
    expect(dashboardSrc).toMatch(/Transfer history/);
    expect(dashboardSrc).toMatch(/historyOpen/);
  });

  it("keeps expanded transfer details with destination and Stripe IDs", () => {
    expect(dashboardSrc).toMatch(/VendorTransferRowDetails/);
    expect(detailsSrc).toMatch(/destinationAccountId/);
    expect(detailsSrc).toMatch(/Stripe transfer ID/);
    expect(detailsSrc).toMatch(/Idempotency key/);
    expect(detailsSrc).toMatch(/Additional accounting context/);
  });

  it("recovered clawbacks are in collapsed history not urgent", () => {
    expect(dashboardSrc).toMatch(/Recovered clawback history/);
    expect(dashboardSrc).toMatch(/reversalIsRecoveredHistory/);
    expect(dashboardSrc).toMatch(/subtleClawback/);
  });

  it("shows financial review actions on needs action rows", () => {
    expect(dashboardSrc).toMatch(/VendorClawbackReviewActions/);
    expect(dashboardSrc).toMatch(/preferFinancialReview/);
    expect(dashboardSrc).toMatch(/transferShowsFinancialReviewActions/);
    expect(dashboardSrc).toMatch(/View order/);
  });

  it("does not use payout terminology for vendor transfers", () => {
    expect(dashboardSrc).toMatch(/Run vendor transfer batch/);
    expect(dashboardSrc).not.toMatch(/Run payout batch/);
    expect(dashboardSrc).not.toMatch(/Retry payout/);
  });
});

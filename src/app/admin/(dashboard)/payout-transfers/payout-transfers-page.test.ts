import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../../..");

describe("admin vendor transfers page terminology", () => {
  it("passes balance error to dashboard so page still renders", () => {
    const pageSrc = readFileSync(
      join(root, "src/app/admin/(dashboard)/payout-transfers/page.tsx"),
      "utf8"
    );
    const dashboardSrc = readFileSync(
      join(root, "src/app/admin/(dashboard)/payout-transfers/PayoutTransfersDashboard.tsx"),
      "utf8"
    );

    expect(pageSrc).toMatch(/fetchStripePlatformBalance/);
    expect(pageSrc).toMatch(/initialBalanceError/);
    expect(dashboardSrc).toMatch(/initialBalanceError/);
    expect(dashboardSrc).toMatch(/Unable to fetch Stripe balance/);
  });

  it("uses Vendor Transfers title and defines Connect transfer", () => {
    const pageSrc = readFileSync(
      join(root, "src/app/admin/(dashboard)/payout-transfers/page.tsx"),
      "utf8"
    );
    expect(pageSrc).toMatch(/Vendor Transfers/);
    expect(pageSrc).toMatch(/ADMIN_VENDOR_TRANSFERS_PAGE_INTRO/);
    expect(pageSrc).not.toMatch(/ADMIN_STRIPE_MONEY_MOVEMENT_DEFINITIONS/);
    expect(pageSrc).not.toMatch(/Payout transfers/);
  });

  it("does not prominently show platform bank payout details by default", () => {
    const pageSrc = readFileSync(
      join(root, "src/app/admin/(dashboard)/payout-transfers/page.tsx"),
      "utf8"
    );
    const dashboardSrc = readFileSync(
      join(root, "src/app/admin/(dashboard)/payout-transfers/PayoutTransfersDashboard.tsx"),
      "utf8"
    );

    expect(pageSrc).not.toMatch(/Platform payout to Open Order bank/);
    expect(dashboardSrc).not.toMatch(/Vendor liability summary/);
    expect(dashboardSrc).not.toMatch(/STRIPE_PLATFORM_PAYOUT_NOT_VENDOR_PAYMENT/);
    expect(dashboardSrc).toMatch(/VendorTransferRowDetails/);
    expect(dashboardSrc).not.toMatch(/StripeMoneyMovementBreakdown/);
  });

  it("uses Retry vendor transfer and blocked vendor transfer copy", () => {
    const dashboardSrc = readFileSync(
      join(root, "src/app/admin/(dashboard)/payout-transfers/PayoutTransfersDashboard.tsx"),
      "utf8"
    );
    expect(dashboardSrc).toMatch(/Retry vendor transfer/);
    expect(dashboardSrc).toMatch(/Run vendor transfer batch/);
    expect(dashboardSrc).toMatch(/Retry all eligible vendor transfers/);
    expect(dashboardSrc).toMatch(/Vendor transfer amount/);
    expect(dashboardSrc).toMatch(/VENDOR_PAID_VIA_CONNECT_LABEL/);
    expect(dashboardSrc).not.toMatch(/Retry payout/);
    expect(dashboardSrc).not.toMatch(/Run payout batch/);
  });

  it("shows cancelled due to refund badge and hides retry for cancelled rows", () => {
    const dashboardSrc = readFileSync(
      join(root, "src/app/admin/(dashboard)/payout-transfers/PayoutTransfersDashboard.tsx"),
      "utf8"
    );
    expect(dashboardSrc).toMatch(/Cancelled due to refund/);
    expect(dashboardSrc).toMatch(/isCancelledDueToRefundTransfer/);
    expect(dashboardSrc).toMatch(/vendorTransferStatusBadgeLabel/);
  });

  it("uses vendor clawback language on reversal section", () => {
    const dashboardSrc = readFileSync(
      join(root, "src/app/admin/(dashboard)/payout-transfers/PayoutTransfersDashboard.tsx"),
      "utf8"
    );
    expect(dashboardSrc).toMatch(/Vendor clawbacks \/ transfer reversals/);
    expect(dashboardSrc).toMatch(/clawback failed/);
  });

  it("explains missing clawbacks must be prepared before reversal batch can run", () => {
    const dashboardSrc = readFileSync(
      join(root, "src/app/admin/(dashboard)/payout-transfers/PayoutTransfersDashboard.tsx"),
      "utf8"
    );
    expect(dashboardSrc).toMatch(/No prepared vendor reversals are pending/);
    expect(dashboardSrc).toMatch(/prepare a vendor reversal from the affected order first/);
    expect(dashboardSrc).toMatch(/preparedPendingReversalCount === 0/);
  });
});

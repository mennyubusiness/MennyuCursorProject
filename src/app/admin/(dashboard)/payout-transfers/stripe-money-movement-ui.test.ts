import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../../..");

describe("admin stripe money movement UI", () => {
  it("payout transfers dashboard separates customer payment, platform payout, and vendor transfer", () => {
    const dashboard = readFileSync(
      join(root, "src/app/admin/(dashboard)/payout-transfers/PayoutTransfersDashboard.tsx"),
      "utf8"
    );
    const panel = readFileSync(
      join(root, "src/app/admin/(dashboard)/orders/[orderId]/AdminPaymentsRefundsPanel.tsx"),
      "utf8"
    );

    expect(dashboard).toMatch(/StripeMoneyMovementBreakdown/);
    expect(dashboard).toMatch(/Vendor liability summary/);
    expect(dashboard).toMatch(/STRIPE_PLATFORM_PAYOUT_NOT_VENDOR_PAYMENT/);
    expect(panel).toMatch(/Stripe money movement/);
    expect(panel).toMatch(/Vendor still owed/);
    expect(panel).toMatch(/OO retained/);
  });

  it("platform payout lookup service is explanatory only on payout page", () => {
    const page = readFileSync(
      join(root, "src/app/admin/(dashboard)/payout-transfers/page.tsx"),
      "utf8"
    );
    expect(page).toMatch(/platformPayoutDisplayForListRow/);
    expect(page).not.toMatch(/transfers\.create/);
  });
});

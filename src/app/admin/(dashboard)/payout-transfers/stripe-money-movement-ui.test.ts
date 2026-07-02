import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../../..");

describe("admin stripe money movement UI terminology", () => {
  it("vendor transfers dashboard focuses on Connect transfers; accounting is collapsed", () => {
    const dashboard = readFileSync(
      join(root, "src/app/admin/(dashboard)/payout-transfers/PayoutTransfersDashboard.tsx"),
      "utf8"
    );
    const rowDetails = readFileSync(
      join(root, "src/components/admin/VendorTransferRowDetails.tsx"),
      "utf8"
    );
    const panel = readFileSync(
      join(root, "src/app/admin/(dashboard)/orders/[orderId]/AdminPaymentsRefundsPanel.tsx"),
      "utf8"
    );
    const breakdown = readFileSync(
      join(root, "src/components/admin/StripeMoneyMovementBreakdown.tsx"),
      "utf8"
    );
    const nav = readFileSync(join(root, "src/components/admin/AdminTopNav.tsx"), "utf8");

    expect(dashboard).toMatch(/VendorTransferRowDetails/);
    expect(dashboard).toMatch(/Stripe available balance/);
    expect(rowDetails).toMatch(/Vendor still owed/);
    expect(dashboard).not.toMatch(/StripeMoneyMovementBreakdown/);
    expect(rowDetails).toMatch(/Additional accounting context/);
    expect(rowDetails).toMatch(/ADMIN_ACCOUNTING_CONTEXT_INTRO/);
    expect(breakdown).toMatch(/Platform payout to Open Order bank/);
    expect(breakdown).toMatch(/mode === "accounting"/);
    expect(panel).toMatch(/StripeMoneyMovementBreakdown/);
    expect(nav).toMatch(/Payouts/);
  });

  it("blocked row copy uses vendor transfer blocked wording", () => {
    const failure = readFileSync(
      join(root, "src/lib/vendor-payout-transfer-failure.ts"),
      "utf8"
    );
    expect(failure).toMatch(/Vendor transfer blocked: insufficient Stripe available balance/);
  });

  it("platform payout lookup on list page does not create Connect transfers", () => {
    const page = readFileSync(
      join(root, "src/app/admin/(dashboard)/payout-transfers/page.tsx"),
      "utf8"
    );
    expect(page).toMatch(/platformPayoutDisplayForListRow/);
    expect(page).not.toMatch(/transfers\.create/);
  });
});

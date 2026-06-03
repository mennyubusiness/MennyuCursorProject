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

  it("uses Vendor Transfers title and defines Connect transfer vs platform payout", () => {
    const pageSrc = readFileSync(
      join(root, "src/app/admin/(dashboard)/payout-transfers/page.tsx"),
      "utf8"
    );
    expect(pageSrc).toMatch(/Vendor Transfers/);
    expect(pageSrc).toMatch(/ADMIN_STRIPE_MONEY_MOVEMENT_DEFINITIONS/);
    expect(pageSrc).not.toMatch(/Payout transfers/);
  });

  it("uses Retry vendor transfer and blocked vendor transfer copy", () => {
    const dashboardSrc = readFileSync(
      join(root, "src/app/admin/(dashboard)/payout-transfers/PayoutTransfersDashboard.tsx"),
      "utf8"
    );
    expect(dashboardSrc).toMatch(/Retry vendor transfer/);
    expect(dashboardSrc).toMatch(/Run vendor transfer batch/);
    expect(dashboardSrc).toMatch(/Retry all eligible vendor transfers/);
    expect(dashboardSrc).not.toMatch(/Retry payout/);
    expect(dashboardSrc).not.toMatch(/Run payout batch/);
  });
});

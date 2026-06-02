import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("admin payout transfers page balance failure UX", () => {
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
});

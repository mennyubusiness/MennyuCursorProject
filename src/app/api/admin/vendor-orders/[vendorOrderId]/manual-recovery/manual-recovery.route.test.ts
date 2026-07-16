import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const routeSrc = readFileSync(
  join(process.cwd(), "src/app/api/admin/vendor-orders/[vendorOrderId]/manual-recovery/route.ts"),
  "utf8"
);

describe("manual recovery route lifecycle", () => {
  it("does not create a new open manual_recovery issue", () => {
    expect(routeSrc).not.toMatch(/createVendorOrderIssue\([\s\S]*manual_recovery/);
    expect(routeSrc).toMatch(/Manual recovery is a resolution event/);
  });

  it("resolves open routing_failure and legacy manual_recovery issues", () => {
    expect(routeSrc).toMatch(/routing_failure/);
    expect(routeSrc).toMatch(/manual_recovery/);
    expect(routeSrc).toMatch(/resolveVendorOrderIssue/);
  });

  it("stores recovery metadata on the vendor order", () => {
    expect(routeSrc).toMatch(/manuallyRecoveredAt/);
    expect(routeSrc).toMatch(/manuallyRecoveredBy/);
    expect(routeSrc).toMatch(/manualRecoveryNotes/);
  });
});

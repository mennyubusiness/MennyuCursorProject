import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const workbenchSrc = readFileSync(join(dir, "IssuesWorkbench.tsx"), "utf8");
const manualRecoveryRouteSrc = readFileSync(
  join(dir, "../../../api/admin/vendor-orders/[vendorOrderId]/manual-recovery/route.ts"),
  "utf8"
);
const attentionSrc = readFileSync(join(dir, "../../../../lib/admin-attention.ts"), "utf8");

describe("IssuesWorkbench recovery UX", () => {
  it("only removes queue row when retry API returns ok true", () => {
    expect(workbenchSrc).toMatch(/data\.ok === true/);
    expect(workbenchSrc).toMatch(/Manual recovery failed\. The item stays in the queue/);
  });

  it("shows manual recovery for eligible vendor orders", () => {
    expect(workbenchSrc).toMatch(/canManualRecover/);
    expect(workbenchSrc).toMatch(/Mark manually received/);
    expect(workbenchSrc).toMatch(/manual-recovery/);
  });

  it("uses canRetryRouting instead of recommendedAction alone", () => {
    expect(workbenchSrc).toMatch(/item\.canRetryRouting === true/);
  });

  it("does not expose dead manual_recovery_required filter", () => {
    expect(workbenchSrc).not.toMatch(/manual_recovery_required/);
  });

  it("shows payment and routing visibility on vendor-order rows", () => {
    expect(workbenchSrc).toMatch(/paymentLabel/);
    expect(workbenchSrc).toMatch(/vendorOrderRoutingStatus/);
    expect(workbenchSrc).toMatch(/deliverectAttempts/);
  });
});

describe("manual recovery API", () => {
  it("requires paid order and recovery notes", () => {
    expect(manualRecoveryRouteSrc).toMatch(/isOrderPaidForAdminRecovery/);
    expect(manualRecoveryRouteSrc).toMatch(/canManualRecoverVendorOrder/);
    expect(manualRecoveryRouteSrc).toMatch(/manualRecoveryNotes/);
    expect(manualRecoveryRouteSrc).toMatch(/NOTE_REQUIRED/);
  });
});

describe("admin attention queue", () => {
  it("attaches recovery action flags to vendor-order items", () => {
    expect(attentionSrc).toMatch(/canRetryRouting/);
    expect(attentionSrc).toMatch(/canManualRecover/);
    expect(attentionSrc).toMatch(/paymentLabel/);
  });

  it("surfaces vendor clawback reversal problems in attention queue", () => {
    expect(attentionSrc).toMatch(/vendor_clawback_failed/);
    expect(attentionSrc).toMatch(/fetchFailedVendorClawbackAttentionItems/);
    expect(attentionSrc).toMatch(/fetchStalePendingVendorClawbackAttentionItems/);
  });
});

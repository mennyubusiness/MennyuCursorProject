import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  fulfillmentSummaryChip,
  isAnyIssueActive,
  isSystemIssueActive,
  paymentChipLabel,
  routingStatusBadge,
} from "./admin-order-detail-ui";

describe("admin-order-detail-ui", () => {
  it("marks system issues open case-insensitively", () => {
    expect(isSystemIssueActive("OPEN")).toBe(true);
    expect(isSystemIssueActive("open")).toBe(true);
    expect(isSystemIssueActive("resolved")).toBe(false);
  });

  it("detects any active customer or system issue", () => {
    expect(
      isAnyIssueActive([{ status: "resolved" }], [{ status: "open", type: "x", severity: "low", notes: null, createdAt: "", resolvedAt: null } as never])
    ).toBe(true);
    expect(isAnyIssueActive([], [])).toBe(false);
  });

  it("labels routing failure badge", () => {
    expect(routingStatusBadge("failed").label).toBe("Routing failed");
  });

  it("summarizes fulfillment chip for failed routing", () => {
    const chip = fulfillmentSummaryChip([
      { routingStatus: "failed", fulfillmentStatus: "pending" },
    ]);
    expect(chip.label).toBe("Routing failed");
  });

  it("payment chip reflects pending payment order status", () => {
    expect(paymentChipLabel("pending_payment")).toBe("Payment pending");
    expect(paymentChipLabel("paid", "fully_refunded")).toBe("Refunded");
  });
});

describe("admin order detail page layout", () => {
  const root = join(process.cwd(), "src/app/admin/(dashboard)/orders/[orderId]");
  const issuesSrc = readFileSync(join(root, "AdminOrderIssuesPanel.tsx"), "utf8");
  const vendorCardSrc = readFileSync(join(root, "AdminVendorOrderCard.tsx"), "utf8");
  const opSrc = readFileSync(join(root, "AdminVendorOrderOperationalPanel.tsx"), "utf8");

  it("notes section uses notes-issues anchor", () => {
    expect(issuesSrc).toMatch(/id="notes-issues"/);
    expect(issuesSrc).toMatch(/Notes &amp; issues/);
  });

  it("vendor card uses plain operational labels", () => {
    expect(vendorCardSrc).toMatch(/AdminVendorOrderOperationalPanel/);
    expect(opSrc).toMatch(/Vendor received order/);
    expect(opSrc).toMatch(/Kitchen status/);
    expect(opSrc).toMatch(/manuallyRecoveredAt/);
  });
});

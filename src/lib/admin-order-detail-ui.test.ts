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
  const pageSrc = readFileSync(join(root, "page.tsx"), "utf8");
  const issuesSrc = readFileSync(join(root, "AdminOrderIssuesPanel.tsx"), "utf8");
  const vendorCardSrc = readFileSync(join(root, "AdminVendorOrderCard.tsx"), "utf8");
  const qaSrc = readFileSync(join(root, "AdminOrderQaToolsSection.tsx"), "utf8");
  const deliverectSrc = readFileSync(join(root, "AdminDeliverectDiagnosticsPanel.tsx"), "utf8");

  it("orders sections: summary, action needed, vendors, payments, timeline, technical", () => {
    expect(pageSrc).toMatch(/AdminOrderDetailHeader/);
    expect(pageSrc).toMatch(/AdminOrderSummaryCard/);
    expect(pageSrc).toMatch(/AdminOrderDetailClientLayout/);
    expect(pageSrc).toMatch(/AdminVendorOrderCard/);
    expect(pageSrc).toMatch(/AdminOrderTimelineSection/);
    expect(pageSrc).toMatch(/AdminOrderTechnicalDetailsSection/);
  });

  it("renders active issues before resolved collapsed section", () => {
    expect(issuesSrc.indexOf("activeSystemIssues")).toBeLessThan(
      issuesSrc.indexOf("Resolved system issues")
    );
    expect(issuesSrc).toMatch(/details className="mt-4 rounded-lg border border-oo-light-stone/);
  });

  it("keeps technical routing details collapsed by default", () => {
    expect(deliverectSrc).toMatch(/Technical routing details/);
    expect(deliverectSrc).toMatch(/<details className="mt-4/);
    expect(vendorCardSrc).toMatch(/AdminVendorOrderTechnicalRoutingDetails/);
  });

  it("gates QA tools via canShowAdminTestToolsUi on page", () => {
    expect(pageSrc).toMatch(/canShowAdminTestToolsUi/);
    expect(pageSrc).toMatch(/showAdminTestTools/);
    expect(qaSrc).toMatch(/Admin QA tools/);
  });

  it("still renders manual recovery notes on vendor operational panel", () => {
    const opSrc = readFileSync(join(root, "AdminVendorOrderOperationalPanel.tsx"), "utf8");
    expect(opSrc).toMatch(/manualRecoveryNotes/);
  });
});

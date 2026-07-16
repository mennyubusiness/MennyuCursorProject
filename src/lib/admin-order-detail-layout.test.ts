import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "src/app/admin/(dashboard)/orders/[orderId]");

describe("admin order detail progressive disclosure layout", () => {
  const pageSrc = readFileSync(join(root, "page.tsx"), "utf8");
  const paymentsSrc = readFileSync(join(root, "AdminPaymentsRefundsPanel.tsx"), "utf8");
  const technicalSrc = readFileSync(join(root, "AdminOrderTechnicalDetailsSection.tsx"), "utf8");
  const timelineSrc = readFileSync(join(root, "AdminOrderTimelineSection.tsx"), "utf8");
  const bridgeSrc = readFileSync(join(root, "AdminOrderIssuesRefundsBridge.tsx"), "utf8");
  const deliverectSrc = readFileSync(join(root, "AdminDeliverectDiagnosticsPanel.tsx"), "utf8");

  it("gates What needs attention on operationalSummary.needsAttention", () => {
    expect(pageSrc).toMatch(/operationalSummary\.needsAttention/);
    expect(pageSrc).toMatch(/buildAdminOrderOperationalSummary/);
    expect(pageSrc).toMatch(
      /\{operationalSummary\.needsAttention \? \(\s*<AdminOrderAttentionCard/
    );
  });

  it("uses basics card without standalone QA on page", () => {
    expect(pageSrc).toMatch(/AdminOrderBasicsCard/);
    expect(pageSrc).not.toMatch(/AdminOrderQaToolsSection/);
    expect(pageSrc).toMatch(/showAdminTestTools=\{showAdminTestTools\}/);
  });

  it("orders client layout: vendors before payments before issues", () => {
    expect(bridgeSrc).toMatch(
      /return \(\s*<>[\s\S]*\{children\}[\s\S]*<AdminPaymentsRefundsPanel[\s\S]*<AdminOrderIssuesPanel/
    );
  });

  it("collapses timeline by default", () => {
    expect(timelineSrc).toMatch(/<details id="order-timeline"/);
    expect(timelineSrc).not.toMatch(/defaultOpen|open=\{/);
  });

  it("places QA tools inside technical details with dev label", () => {
    expect(technicalSrc).toMatch(/Dev \/ staging QA tools/);
    expect(technicalSrc).toMatch(/AdminOrderQaToolsSection/);
    expect(technicalSrc).toMatch(/<details[\s\S]*id="technical-details"/);
  });

  it("does not default-show Stripe money movement in payments panel", () => {
    expect(paymentsSrc).toMatch(/Show Stripe details/);
    expect(paymentsSrc).not.toMatch(
      /<h3 className="text-sm font-semibold text-oo-charcoal">Stripe money movement<\/h3>\s*<div className="mt-3">\s*<StripeMoneyMovementBreakdown/
    );
  });

  it("collapses vendor transfer accounting unless clawback unresolved", () => {
    expect(paymentsSrc).toMatch(/Show vendor transfer accounting/);
    expect(paymentsSrc).toMatch(/orderHasUnresolvedClawback/);
    expect(paymentsSrc).toMatch(/open=\{highlightTransferBreakdown\}/);
  });

  it("keeps technical routing collapsed in vendor diagnostics", () => {
    expect(deliverectSrc).toMatch(/Technical routing details/);
    expect(deliverectSrc).toMatch(/<details/);
  });
});

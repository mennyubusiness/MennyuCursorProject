import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const adminVendorDir = dirname(fileURLToPath(import.meta.url));

function readAdminVendor(relativePath: string): string {
  return readFileSync(join(adminVendorDir, relativePath), "utf8");
}

describe("admin vendor detail overview hierarchy", () => {
  it("order routing section uses provider-agnostic copy", () => {
    const routing = readAdminVendor("AdminVendorOrderRoutingSection.tsx");
    expect(routing).toContain("ADMIN_ORDER_ROUTING_GENERIC_COPY");
    expect(routing).toContain("adminActiveRoutingStatusMessage");
    expect(routing).not.toContain(
      "Menu source stays separate from order routing. Square routing keeps Open Order menu builder"
    );
  });

  it("primary active routing box uses provider message not raw Square status", () => {
    const routing = readAdminVendor("AdminVendorOrderRoutingSection.tsx");
    expect(routing).toContain("{activeStatus.message}");
    expect(routing).toContain("Active routing");
    expect(routing).not.toContain("<p>{squareStatus.statusMessage}</p>");
  });

  it("does not render separate Square injection enable/disable controls", () => {
    const routing = readAdminVendor("AdminVendorOrderRoutingSection.tsx");
    expect(routing).not.toContain("Enable Square order injection");
    expect(routing).not.toContain("Disable Square order injection");
    expect(routing).not.toContain("adminSetSquareOrderRoutingEnabledAction");
  });

  it("order routing section is a mode selector only without provider readiness blocks", () => {
    const routing = readAdminVendor("AdminVendorOrderRoutingSection.tsx");
    expect(routing).not.toContain("incompleteWarning");
    expect(routing).not.toContain("adminSquareRoutingStatusSummary");
    expect(routing).not.toContain("Open Square integration");
    expect(routing).not.toContain("SQUARE_ROUTING_LIVE");
    expect(routing).not.toContain("border-amber-200");
    expect(routing).toContain('checked={mode === "manual_dashboard"}');
    expect(routing).toContain('checked={mode === "deliverect"}');
    expect(routing).toContain('checked={mode === "square"}');
    expect(routing).toContain("adminUpdateVendorOrderRoutingModeAction");
    expect(routing).toContain("Save order routing mode");
  });

  it("main vendor page is an overview without Square env or raw mapping dumps", () => {
    const page = readAdminVendor("page.tsx");
    const overview = readAdminVendor("AdminVendorOverview.tsx");
    expect(page).toContain("buildAdminVendorSummary");
    expect(page).toContain("AdminVendorOverview");
    expect(page).not.toContain("ENABLE_SQUARE_INTEGRATION");
    expect(page).not.toContain("SQUARE_ROUTING_LIVE");
    expect(page).not.toContain("Business hours debug");
    expect(page).not.toContain("AdminSquareOrderInjectionDiagnosticsPanel");
    expect(overview).toContain("Attention required");
    expect(overview).toContain("Status overview");
    expect(overview).toContain("Quick actions");
    expect(overview).toContain("Technical diagnostics");
    expect(overview).not.toContain("ENABLE_SQUARE_INTEGRATION");
    expect(overview).not.toContain("externalMerchantId");
    expect(overview).not.toContain("Minutes since midnight");
  });

  it("gates Square injection diagnostics to technical diagnostics page", () => {
    const diagnostics = readAdminVendor("AdminVendorTechnicalDiagnostics.tsx");
    expect(diagnostics).toContain("adminSquareInjectionDiagnosticsVisible");
    expect(diagnostics).toContain("showSquareDiagnostics && squareInjectionDiagnostics");
    expect(diagnostics).toContain("AdminSquareOrderInjectionDiagnosticsPanel");
    expect(diagnostics).toContain("Business hours debug");
    expect(diagnostics).toContain("Connected POS through Deliverect");
  });

  it("keeps detailed Deliverect diagnostics outside the main overview", () => {
    const diagnostics = readAdminVendor("AdminVendorTechnicalDiagnostics.tsx");
    expect(diagnostics).toContain('title="Menu / Deliverect status"');
    expect(diagnostics).toContain('label="Deliverect connection"');
  });

  it("collapses inactive provider diagnostics on technical page", () => {
    const diagnostics = readAdminVendor("AdminVendorTechnicalDiagnostics.tsx");
    expect(diagnostics).toContain("Other connected integrations");
    expect(diagnostics).toContain("adminInactiveSquareDiagnosticsVisible");
    expect(diagnostics).toContain("Square (not active routing)");
  });

  it("moves engineering tools to diagnostics route", () => {
    const diagnosticsPage = readAdminVendor("diagnostics/page.tsx");
    expect(diagnosticsPage).toContain("getAdminVendorDetailTools");
    expect(diagnosticsPage).toContain("Technical diagnostics");
    const page = readAdminVendor("page.tsx");
    expect(page).not.toContain("getAdminVendorDetailTools");
  });
});

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const adminVendorDir = dirname(fileURLToPath(import.meta.url));

function readAdminVendor(relativePath: string): string {
  return readFileSync(join(adminVendorDir, relativePath), "utf8");
}

describe("admin vendor detail provider cleanup", () => {
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
    expect(routing).toContain("adminSquareRoutingStatusSummary");
  });

  it("gates Square injection diagnostics to Square routing vendors", () => {
    const rescue = readAdminVendor("AdminVendorRescueClient.tsx");
    expect(rescue).toContain("adminSquareInjectionDiagnosticsVisible");
    expect(rescue).toContain("showSquareDiagnostics && squareInjectionDiagnostics");
  });

  it("labels Deliverect downstream POS separately from routing provider", () => {
    const rescue = readAdminVendor("AdminVendorRescueClient.tsx");
    expect(rescue).toContain("Connected POS through Deliverect");
    expect(rescue).toContain("formatAdminDownstreamPosProvider");
    expect(rescue).not.toContain('label="POS provider"');
  });

  it("overview uses routing provider and menu status labels", () => {
    const rescue = readAdminVendor("AdminVendorRescueClient.tsx");
    expect(rescue).toContain('label="Routing provider"');
    expect(rescue).toContain('label="Menu status"');
    expect(rescue).toContain("adminVendorOverviewRoutingProviderLabel");
    expect(rescue).toContain("adminVendorMenuStatusLabel");
  });

  it("collapses inactive provider diagnostics", () => {
    const rescue = readAdminVendor("AdminVendorRescueClient.tsx");
    expect(rescue).toContain("Other connected integrations");
    expect(rescue).toContain("adminInactiveSquareDiagnosticsVisible");
    expect(rescue).toContain("Square (not active routing)");
  });

  it("filters tools by routing mode on admin vendor page", () => {
    const page = readAdminVendor("page.tsx");
    expect(page).toContain("getAdminVendorDetailTools");
    expect(page).not.toContain("adminPosMappingToolVisible");
  });
});

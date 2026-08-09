import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildVendorSetupIntegrationsView,
  evaluateVendorSetupMenuSourceReadiness,
  vendorSetupMenuSourceTitle,
  vendorSetupPageShowsInactiveProviderAsBlocker,
} from "@/lib/vendor-setup-integrations";
import type { VendorIntegrationReadinessSummary } from "@/lib/integrations/provider-readiness.service";
import type { ProviderConnectionHealth } from "@/lib/integrations/types";

const vendorDir = dirname(fileURLToPath(import.meta.url));

vi.mock("@/lib/vendor-routing-availability", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/vendor-routing-availability")>();
  return {
    ...actual,
    vendorMayConfigurePosOrderRouting: vi.fn(() => false),
  };
});

import { vendorMayConfigurePosOrderRouting } from "@/lib/vendor-routing-availability";

function readSetupPage(): string {
  return readFileSync(join(vendorDir, "setup/page.tsx"), "utf8");
}

function readyHealth(provider: ProviderConnectionHealth["provider"]): ProviderConnectionHealth {
  return {
    provider,
    status: "connected",
    isReady: true,
    missingRequirements: [],
    warnings: [],
    lastCheckedAt: new Date(),
  };
}

function notReadyHealth(
  provider: ProviderConnectionHealth["provider"],
  missing: string[]
): ProviderConnectionHealth {
  return {
    provider,
    status: "not_configured",
    isReady: false,
    missingRequirements: missing,
    warnings: [],
    lastCheckedAt: new Date(),
  };
}

function readinessSummary(input: {
  routingMode: "deliverect" | "square" | "manual_dashboard";
  routingReady?: boolean;
  menuSource?: "deliverect" | "open_order";
  menuReady?: boolean;
}): VendorIntegrationReadinessSummary {
  const routingProvider =
    input.routingMode === "deliverect"
      ? "deliverect"
      : input.routingMode === "square"
        ? "square"
        : "manual_dashboard";
  const menuProvider = input.menuSource === "deliverect" ? "deliverect" : "open_order";
  const routingReady = input.routingReady ?? true;
  const menuReady = input.menuReady ?? true;

  return {
    orderRouting: {
      activeProvider: routingProvider,
      health: routingReady
        ? readyHealth(routingProvider)
        : notReadyHealth(routingProvider, ["Routing incomplete"]),
    },
    menuSource: {
      activeProvider: menuProvider,
      health: menuReady ? readyHealth(menuProvider) : notReadyHealth(menuProvider, ["Menu incomplete"]),
    },
    labels: {
      orderRouting: `Order routing: ${routingProvider}`,
      menuSource: `Menu source: ${menuProvider}`,
    },
  };
}

describe("vendor setup integrations view (beta tablet-only)", () => {
  beforeEach(() => {
    vi.mocked(vendorMayConfigurePosOrderRouting).mockReturnValue(false);
  });

  it("presents tablet order management for legacy Deliverect vendors without POS CTAs", () => {
    const model = buildVendorSetupIntegrationsView({
      vendorId: "v1",
      orderRoutingMode: "deliverect",
      menuSource: "deliverect",
      readiness: readinessSummary({ routingMode: "deliverect" }),
      menuReadiness: {
        menuSource: "deliverect",
        orderRoutingMode: "deliverect",
        hasPublishedMenuVersion: true,
        hasOperationalItems: true,
      },
      squareHealth: notReadyHealth("square", ["Square is not connected for this vendor"]),
      deliverectRoutingHealth: readyHealth("deliverect"),
    });

    expect(model.activeRouting.title).toBe("Open Order dashboard");
    expect(model.activeRouting.actions.map((a) => a.href)).toEqual(["/vendor/v1/kitchen"]);
    expect(model.activeRouting.actions.some((a) => a.href.includes("connect-pos"))).toBe(false);
    expect(model.availableIntegrations).toEqual([]);
    expect(model.connectedIntegrations).toEqual([]);
  });

  it("presents tablet order management for legacy Square vendors without Square CTAs", () => {
    const model = buildVendorSetupIntegrationsView({
      vendorId: "v1",
      orderRoutingMode: "square",
      menuSource: "open_order",
      readiness: readinessSummary({ routingMode: "square" }),
      menuReadiness: {
        menuSource: "open_order",
        orderRoutingMode: "square",
        hasPublishedMenuVersion: false,
        hasOperationalItems: true,
        hasSquarePublishedMenu: true,
      },
      squareHealth: readyHealth("square"),
      deliverectRoutingHealth: notReadyHealth("deliverect", ["Deliverect not connected"]),
    });

    expect(model.activeRouting.title).toBe("Open Order dashboard");
    expect(model.activeRouting.actions.some((a) => a.href.includes("integrations/square"))).toBe(
      false
    );
    expect(model.availableIntegrations).toEqual([]);
  });

  it("shows Open Order dashboard for tablet vendors without available POS integrations", () => {
    const model = buildVendorSetupIntegrationsView({
      vendorId: "v1",
      orderRoutingMode: "manual_dashboard",
      menuSource: "open_order",
      readiness: readinessSummary({ routingMode: "manual_dashboard" }),
      menuReadiness: {
        menuSource: "open_order",
        orderRoutingMode: "manual_dashboard",
        hasPublishedMenuVersion: true,
        hasOperationalItems: true,
      },
      squareHealth: notReadyHealth("square", ["Square is not connected for this vendor"]),
      deliverectRoutingHealth: notReadyHealth("deliverect", ["Deliverect not connected"]),
    });

    expect(model.activeRouting.title).toBe("Open Order dashboard");
    expect(model.activeRouting.status).toBe("ready");
    expect(model.availableIntegrations).toHaveLength(0);
    expect(model.activeMenuSource.actions[0]?.href).toBe("/vendor/v1/menu-builder");
  });

  it("keeps active menu source independent from routing mode", () => {
    const title = vendorSetupMenuSourceTitle({
      menuSource: "deliverect",
      orderRoutingMode: "manual_dashboard",
    });
    expect(title).toBe("Menu source: Deliverect");
  });

  it("evaluates square catalog menu readiness separately", () => {
    const ready = evaluateVendorSetupMenuSourceReadiness({
      menuSource: "open_order",
      orderRoutingMode: "square",
      hasPublishedMenuVersion: false,
      hasOperationalItems: true,
      hasSquarePublishedMenu: true,
    });
    expect(ready.ready).toBe(true);

    const blocked = evaluateVendorSetupMenuSourceReadiness({
      menuSource: "open_order",
      orderRoutingMode: "square",
      hasPublishedMenuVersion: false,
      hasOperationalItems: false,
      hasSquarePublishedMenu: false,
    });
    expect(blocked.ready).toBe(false);
    expect(blocked.blockers[0]).toMatch(/Square catalog/i);
  });

  it("hub surface keeps tablet CTAs for legacy providers during beta", () => {
    const deliverect = buildVendorSetupIntegrationsView({
      vendorId: "v1",
      orderRoutingMode: "deliverect",
      menuSource: "deliverect",
      readiness: readinessSummary({ routingMode: "deliverect" }),
      menuReadiness: {
        menuSource: "deliverect",
        orderRoutingMode: "deliverect",
        hasPublishedMenuVersion: true,
        hasOperationalItems: true,
      },
      squareHealth: null,
      deliverectRoutingHealth: readyHealth("deliverect"),
      surface: "hub",
    });
    expect(deliverect.activeRouting.actions.map((a) => a.href)).toEqual([
      "/vendor/v1/kitchen",
      "/vendor/v1/dashboard",
    ]);
    expect(deliverect.connectedIntegrations).toEqual([]);
  });
});

describe("vendor setup integrations view when POS selection re-enabled", () => {
  beforeEach(() => {
    vi.mocked(vendorMayConfigurePosOrderRouting).mockReturnValue(true);
  });

  it("shows Deliverect as active routing and Square as available", () => {
    const model = buildVendorSetupIntegrationsView({
      vendorId: "v1",
      orderRoutingMode: "deliverect",
      menuSource: "deliverect",
      readiness: readinessSummary({ routingMode: "deliverect" }),
      menuReadiness: {
        menuSource: "deliverect",
        orderRoutingMode: "deliverect",
        hasPublishedMenuVersion: true,
        hasOperationalItems: true,
      },
      squareHealth: notReadyHealth("square", ["Square is not connected for this vendor"]),
      deliverectRoutingHealth: readyHealth("deliverect"),
    });

    expect(model.activeRouting.title).toBe("Deliverect");
    expect(model.availableIntegrations.some((card) => card.id === "square")).toBe(true);
  });
});

describe("inactive provider blocker rules", () => {
  it("treats inactive providers as non-blocking for setup readiness", () => {
    expect(vendorSetupPageShowsInactiveProviderAsBlocker("deliverect", "square")).toBe(false);
    expect(vendorSetupPageShowsInactiveProviderAsBlocker("square", "deliverect")).toBe(false);
    expect(vendorSetupPageShowsInactiveProviderAsBlocker("manual_dashboard", "square")).toBe(
      false
    );
    expect(vendorSetupPageShowsInactiveProviderAsBlocker("square", "square")).toBe(true);
  });
});

function readIntegrationsHubPage(): string {
  return readFileSync(join(vendorDir, "integrations/page.tsx"), "utf8");
}

describe("vendor setup page layout", () => {
  it("does not render generic Integration readiness card with Square connection row", () => {
    const setup = readSetupPage();
    expect(setup).not.toContain("VendorIntegrationReadinessCard");
    expect(setup).not.toContain("Square connection");
    expect(setup).not.toContain("VendorSquareSetupSummary");
    expect(setup).toContain("VendorIntegrationsSection");
    expect(setup).toContain("loadVendorIntegrationsViewModel");
  });

  it("places integrations section below setup checklists", () => {
    const setup = readSetupPage();
    const appearanceIndex = setup.indexOf('title="Required to appear on pod page"');
    const acceptingChecklistIndex = setup.indexOf(
      '<VendorSetupChecklist items={acceptingOrders} title="Required to accept orders" />'
    );
    const integrationsIndex = setup.indexOf("<VendorIntegrationsSection model={integrations.model}");
    expect(appearanceIndex).toBeGreaterThan(-1);
    expect(acceptingChecklistIndex).toBeGreaterThan(appearanceIndex);
    expect(integrationsIndex).toBeGreaterThan(acceptingChecklistIndex);
  });

  it("uses collapsible setup checklists", () => {
    const checklist = readFileSync(
      join(vendorDir, "../../../components/vendor/VendorSetupChecklist.tsx"),
      "utf8"
    );
    expect(checklist).toContain("vendorSetupChecklistSummary");
    expect(checklist).toContain("defaultExpanded");
    expect(checklist).toContain("Still needed:");
  });

  it("keeps available integrations markup for when POS selection is re-enabled", () => {
    const section = readFileSync(
      join(vendorDir, "../../../components/vendor/VendorSetupIntegrationsSection.tsx"),
      "utf8"
    );
    expect(section).toContain("Available integrations");
    expect(section).toContain("Connected integrations");
    expect(section).toContain("vendorMayConfigurePosOrderRouting");
  });
});

describe("vendor integrations hub page", () => {
  it("replaces VendorIntegrationReadinessCard with shared provider-aware section", () => {
    const hub = readIntegrationsHubPage();
    expect(hub).not.toContain("VendorIntegrationReadinessCard");
    expect(hub).not.toContain("Square connection");
    expect(hub).not.toContain("Provider connections");
    expect(hub).toContain("VendorIntegrationsSection");
    expect(hub).toContain('surface="hub"');
    expect(hub).toContain("loadVendorIntegrationsViewModel");
  });
});

describe("provider-ux regression: setup and hub share the same view model", () => {
  beforeEach(() => {
    vi.mocked(vendorMayConfigurePosOrderRouting).mockReturnValue(false);
  });

  it("builds identical active routing cards for setup and hub (beta)", () => {
    const input = {
      vendorId: "v1",
      orderRoutingMode: "manual_dashboard" as const,
      menuSource: "open_order" as const,
      readiness: readinessSummary({ routingMode: "manual_dashboard" }),
      menuReadiness: {
        menuSource: "open_order" as const,
        orderRoutingMode: "manual_dashboard" as const,
        hasPublishedMenuVersion: true,
        hasOperationalItems: true,
      },
      squareHealth: null,
      deliverectRoutingHealth: null,
    };
    const setup = buildVendorSetupIntegrationsView({ ...input, surface: "setup" });
    const hub = buildVendorSetupIntegrationsView({ ...input, surface: "hub" });
    expect(setup.activeRouting.title).toBe(hub.activeRouting.title);
    expect(setup.activeMenuSource.title).toBe(hub.activeMenuSource.title);
  });
});

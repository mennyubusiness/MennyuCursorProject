import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildVendorSetupIntegrationsView,
  evaluateVendorSetupMenuSourceReadiness,
  vendorSetupMenuSourceTitle,
  vendorSetupPageShowsInactiveProviderAsBlocker,
} from "@/lib/vendor-setup-integrations";
import type { VendorIntegrationReadinessSummary } from "@/lib/integrations/provider-readiness.service";
import type { ProviderConnectionHealth } from "@/lib/integrations/types";

const vendorDir = dirname(fileURLToPath(import.meta.url));

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

describe("vendor setup integrations view", () => {
  it("shows Deliverect as active routing for deliverect vendors", () => {
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
    expect(model.activeRouting.status).toBe("ready");
    expect(model.activeRouting.blockers).not.toContain("Square is not connected for this vendor");
    expect(model.availableIntegrations.some((card) => card.id === "square")).toBe(true);
    expect(model.availableIntegrations.find((card) => card.id === "square")?.status).not.toBe(
      "needs_attention"
    );
  });

  it("shows Square as active routing for square vendors", () => {
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

    expect(model.activeRouting.title).toBe("Square");
    expect(model.activeMenuSource.title).toBe("Menu source: Square catalog");
    expect(model.availableIntegrations.some((card) => card.id === "deliverect")).toBe(true);
    expect(model.availableIntegrations.find((card) => card.id === "deliverect")?.status).not.toBe(
      "needs_attention"
    );
  });

  it("shows manual dashboard as active routing for tablet vendors", () => {
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

    expect(model.activeRouting.title).toBe("Open Order Dashboard / Tablet");
    expect(model.activeRouting.status).toBe("ready");
    expect(model.availableIntegrations).toHaveLength(3);
    expect(
      model.availableIntegrations.every((card) => card.status !== "needs_attention")
    ).toBe(true);
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

  it("hub surface splits connected inactive providers into connected section", () => {
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
      squareHealth: readyHealth("square"),
      deliverectRoutingHealth: readyHealth("deliverect"),
      surface: "hub",
    });

    expect(model.connectedIntegrations.some((card) => card.id === "square")).toBe(true);
    expect(model.availableIntegrations.some((card) => card.id === "square")).toBe(false);
  });

  it("hub surface adds deeper routing actions per provider", () => {
    const manual = buildVendorSetupIntegrationsView({
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
      squareHealth: null,
      deliverectRoutingHealth: null,
      surface: "hub",
    });
    expect(manual.activeRouting.actions.map((a) => a.href)).toEqual([
      "/vendor/v1/kitchen",
      "/vendor/v1/dashboard",
    ]);

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
    expect(deliverect.activeRouting.actions.map((a) => a.label)).toEqual([
      "Manage POS settings",
      "View menu imports",
    ]);

    const square = buildVendorSetupIntegrationsView({
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
      deliverectRoutingHealth: null,
      surface: "hub",
    });
    expect(square.activeRouting.actions.map((a) => a.href)).toEqual([
      "/vendor/v1/integrations/square",
      "/vendor/v1/menu/imports",
    ]);
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

  it("collapses available integrations by default", () => {
    const section = readFileSync(
      join(vendorDir, "../../../components/vendor/VendorSetupIntegrationsSection.tsx"),
      "utf8"
    );
    expect(section).toContain("Available integrations");
    expect(section).toContain("Connected integrations");
    expect(section).toContain("<details");
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

  it("does not show cross-provider missing warnings on deliverect hub", () => {
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
      surface: "hub",
    });

    expect(model.activeRouting.title).toBe("Deliverect");
    expect(
      [...model.connectedIntegrations, ...model.availableIntegrations].every(
        (card) => card.status !== "needs_attention"
      )
    ).toBe(true);
    expect(
      model.availableIntegrations.find((card) => card.id === "square")?.statusLabel
    ).not.toMatch(/Needs attention/i);
  });

  it("does not show cross-provider missing warnings on square hub", () => {
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
      surface: "hub",
    });

    expect(model.activeRouting.title).toBe("Square");
    expect(
      [...model.connectedIntegrations, ...model.availableIntegrations].every(
        (card) => card.status !== "needs_attention"
      )
    ).toBe(true);
  });

  it("does not require POS providers for manual hub", () => {
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
      surface: "hub",
    });

    expect(model.activeRouting.status).toBe("ready");
    expect(
      [...model.connectedIntegrations, ...model.availableIntegrations].every(
        (card) => card.status !== "needs_attention"
      )
    ).toBe(true);
  });
});

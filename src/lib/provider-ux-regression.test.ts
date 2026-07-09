import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildVendorSetupIntegrationsView,
  vendorSetupPageShowsInactiveProviderAsBlocker,
} from "@/lib/vendor-setup-integrations";
import type { ProviderConnectionHealth } from "@/lib/integrations/types";
import type { VendorIntegrationReadinessSummary } from "@/lib/integrations/provider-readiness.service";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function walkTsFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === ".next" || entry === "dist") continue;
      walkTsFiles(full, acc);
      continue;
    }
    if (/\.(tsx?|jsx?)$/.test(entry)) acc.push(full);
  }
  return acc;
}

function readRepo(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8");
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

function readinessSummary(
  routingMode: "deliverect" | "square" | "manual_dashboard"
): VendorIntegrationReadinessSummary {
  const routingProvider =
    routingMode === "deliverect"
      ? "deliverect"
      : routingMode === "square"
        ? "square"
        : "manual_dashboard";
  return {
    orderRouting: {
      activeProvider: routingProvider,
      health: readyHealth(routingProvider),
    },
    menuSource: {
      activeProvider: routingMode === "deliverect" ? "deliverect" : "open_order",
      health: readyHealth(routingMode === "deliverect" ? "deliverect" : "open_order"),
    },
    labels: {
      orderRouting: `Order routing: ${routingProvider}`,
      menuSource: "Menu source",
    },
  };
}

describe("provider UX regression — dead code", () => {
  it("has no remaining imports of removed legacy integration components", () => {
    const srcFiles = walkTsFiles(join(repoRoot, "src"));
    const legacyPatterns = [
      /from ["']@\/components\/vendor\/VendorIntegrationReadinessCard["']/,
      /from ["']@\/components\/vendor\/VendorSquareSetupSummary["']/,
    ];

    const offenders: string[] = [];
    for (const file of srcFiles) {
      const content = readFileSync(file, "utf8");
      for (const pattern of legacyPatterns) {
        if (pattern.test(content)) {
          offenders.push(file.replace(repoRoot + "\\", "").replace(repoRoot + "/", ""));
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("uses a single shared integrations loader for setup and hub", () => {
    const setup = readRepo("src/app/vendor/[vendorId]/setup/page.tsx");
    const hub = readRepo("src/app/vendor/[vendorId]/integrations/page.tsx");
    expect(setup).toContain("loadVendorIntegrationsViewModel");
    expect(hub).toContain("loadVendorIntegrationsViewModel");
    expect(setup).not.toContain("getVendorIntegrationObservability");
    expect(hub).not.toContain("getVendorIntegrationObservability");
    expect(setup).not.toContain("buildVendorSetupIntegrationsView");
    expect(hub).not.toContain("buildVendorSetupIntegrationsView");
  });
});

describe("provider UX regression — remaining entry points", () => {
  it("wires provider-aware surfaces to shared display helpers", () => {
    expect(readRepo("src/app/vendor/[vendorId]/menu/imports/page.tsx")).toContain(
      "vendorMenuImportsPageSubtitle"
    );
    expect(readRepo("src/app/vendor/[vendorId]/kitchen/page.tsx")).toContain(
      "vendorKitchenStatusWarning"
    );
    expect(readRepo("src/app/admin/(dashboard)/vendors/[vendorId]/AdminVendorOrderRoutingSection.tsx")).toContain(
      "ADMIN_ORDER_ROUTING_GENERIC_COPY"
    );
    expect(readRepo("src/components/vendor/VendorSetupIntegrationsSection.tsx")).toContain(
      "Active order routing"
    );
  });

  it("keeps Square OAuth detail on the dedicated Square integration page", () => {
    const squarePage = readRepo("src/app/vendor/[vendorId]/integrations/square/page.tsx");
    expect(squarePage).toContain("VendorSquareConnectionCard");
    expect(squarePage).not.toContain("VendorIntegrationReadinessCard");
  });
});

describe("provider UX regression — inactive providers never block", () => {
  const cases = [
    {
      label: "Deliverect vendor",
      mode: "deliverect" as const,
      menuSource: "deliverect" as const,
      inactiveId: "square",
    },
    {
      label: "Square vendor",
      mode: "square" as const,
      menuSource: "open_order" as const,
      inactiveId: "deliverect",
    },
    {
      label: "Manual vendor",
      mode: "manual_dashboard" as const,
      menuSource: "open_order" as const,
      inactiveId: "square",
    },
  ];

  for (const testCase of cases) {
    it(`${testCase.label} integrations model marks inactive providers as non-blocking`, () => {
      const model = buildVendorSetupIntegrationsView({
        vendorId: "v1",
        orderRoutingMode: testCase.mode,
        menuSource: testCase.menuSource,
        readiness: readinessSummary(testCase.mode),
        menuReadiness: {
          menuSource: testCase.menuSource,
          orderRoutingMode: testCase.mode,
          hasPublishedMenuVersion: true,
          hasOperationalItems: true,
          hasSquarePublishedMenu: testCase.mode === "square",
        },
        squareHealth: notReadyHealth("square", ["Square is not connected for this vendor"]),
        deliverectRoutingHealth: notReadyHealth("deliverect", ["Deliverect not connected"]),
        surface: "hub",
      });

      const inactiveCards = [...model.connectedIntegrations, ...model.availableIntegrations];
      expect(
        inactiveCards.every((card) => card.status !== "needs_attention")
      ).toBe(true);
      expect(vendorSetupPageShowsInactiveProviderAsBlocker(testCase.mode, testCase.inactiveId)).toBe(
        false
      );
    });
  }
});

describe("provider UX regression — public/customer surfaces", () => {
  it("customer pod menu pages do not render provider integration diagnostics", () => {
    const podVendorPage = readRepo("src/app/[podSlug]/[vendorSlug]/page.tsx");
    expect(podVendorPage).not.toContain("Integration readiness");
    expect(podVendorPage).not.toContain("Square connection");
    expect(podVendorPage).not.toContain("Deliverect routing");
    expect(podVendorPage).not.toContain("SQUARE_ROUTING_LIVE");
  });

  it("checkout flow does not import vendor integration setup helpers", () => {
    const checkout = readRepo("src/app/checkout/page.tsx");
    expect(checkout).not.toContain("vendor-setup-integrations");
    expect(checkout).not.toContain("VendorIntegrationsSection");
    expect(checkout).not.toContain("loadVendorIntegrationsViewModel");
  });
});

describe("provider UX regression — active blockers only where actionable", () => {
  it("shows routing blockers only on the active routing card", () => {
    const model = buildVendorSetupIntegrationsView({
      vendorId: "v1",
      orderRoutingMode: "square",
      menuSource: "open_order",
      readiness: {
        ...readinessSummary("square"),
        orderRouting: {
          activeProvider: "square",
          health: notReadyHealth("square", ["Connect Square OAuth"]),
        },
      },
      menuReadiness: {
        menuSource: "open_order",
        orderRoutingMode: "square",
        hasPublishedMenuVersion: false,
        hasOperationalItems: false,
        hasSquarePublishedMenu: false,
      },
      squareHealth: notReadyHealth("square", ["Connect Square OAuth"]),
      deliverectRoutingHealth: notReadyHealth("deliverect", ["Deliverect not connected"]),
      surface: "hub",
    });

    expect(model.activeRouting.status).toBe("needs_attention");
    expect(model.activeRouting.blockers).toContain("Connect Square OAuth");
    expect(
      model.availableIntegrations.find((card) => card.id === "deliverect")?.blockers
    ).toEqual([]);
  });
});

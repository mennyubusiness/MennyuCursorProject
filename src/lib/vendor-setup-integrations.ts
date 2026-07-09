import type { VendorMenuSource, VendorOrderRoutingMode } from "@prisma/client";
import type { VendorIntegrationReadinessSummary } from "@/lib/integrations/provider-readiness.service";
import type { ProviderConnectionHealth } from "@/lib/integrations/types";
import {
  getProviderDisplayProfile,
  getToastPlaceholderProfile,
} from "@/lib/integrations/provider-display";
import {
  isDeliverectRoutingMode,
  isManualDashboardRoutingMode,
  isSquareRoutingMode,
} from "@/lib/vendor-order-routing-mode";
import { isDeliverectMenuSource } from "@/lib/vendor-menu-source";
import { vendorMenuManagementPath } from "@/lib/vendor-menu-management";

export type VendorSetupIntegrationStatus =
  | "ready"
  | "needs_attention"
  | "available"
  | "not_configured";

export type VendorSetupIntegrationCardView = {
  id: string;
  title: string;
  status: VendorSetupIntegrationStatus;
  statusLabel: string;
  copy: string;
  ctaHref: string | null;
  ctaLabel: string | null;
  blockers: string[];
};

export type VendorSetupIntegrationsViewModel = {
  activeRouting: VendorSetupIntegrationCardView;
  activeMenuSource: VendorSetupIntegrationCardView;
  availableIntegrations: VendorSetupIntegrationCardView[];
};

export type VendorSetupMenuSourceReadinessInput = {
  menuSource: VendorMenuSource;
  orderRoutingMode: VendorOrderRoutingMode;
  hasPublishedMenuVersion: boolean;
  hasOperationalItems: boolean;
  hasSquarePublishedMenu?: boolean;
};

function integrationStatusLabel(status: VendorSetupIntegrationStatus): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "needs_attention":
      return "Needs attention";
    case "available":
      return "Available";
    case "not_configured":
      return "Not configured";
  }
}

function activeRoutingTitle(orderRoutingMode: VendorOrderRoutingMode): string {
  if (isManualDashboardRoutingMode(orderRoutingMode)) {
    return "Open Order Dashboard / Tablet";
  }
  if (isDeliverectRoutingMode(orderRoutingMode)) {
    return "Deliverect";
  }
  return "Square";
}

function activeRoutingCopy(orderRoutingMode: VendorOrderRoutingMode): string {
  return getProviderDisplayProfile(orderRoutingMode).routingDescription;
}

function activeRoutingCta(
  vendorId: string,
  orderRoutingMode: VendorOrderRoutingMode
): { href: string; label: string } {
  if (isManualDashboardRoutingMode(orderRoutingMode)) {
    return { href: `/vendor/${vendorId}/kitchen`, label: "Open kitchen mode" };
  }
  if (isDeliverectRoutingMode(orderRoutingMode)) {
    return { href: `/vendor/${vendorId}/connect-pos`, label: "Manage Deliverect setup" };
  }
  return { href: `/vendor/${vendorId}/integrations/square`, label: "Manage Square integration" };
}

export function vendorSetupMenuSourceTitle(input: {
  menuSource: VendorMenuSource;
  orderRoutingMode: VendorOrderRoutingMode;
}): string {
  if (isDeliverectMenuSource(input)) {
    return "Menu source: Deliverect";
  }
  if (isSquareRoutingMode(input.orderRoutingMode)) {
    return "Menu source: Square catalog";
  }
  return "Menu source: Open Order menu builder";
}

export function vendorSetupMenuSourceCopy(input: {
  menuSource: VendorMenuSource;
  orderRoutingMode: VendorOrderRoutingMode;
}): string {
  if (isDeliverectMenuSource(input)) {
    return "Menus sync from Deliverect imports and publish flow.";
  }
  if (isSquareRoutingMode(input.orderRoutingMode)) {
    return "Menus are imported from your Square catalog.";
  }
  return "Menus are built and published in the Open Order menu builder.";
}

export function evaluateVendorSetupMenuSourceReadiness(
  input: VendorSetupMenuSourceReadinessInput
): { ready: boolean; blockers: string[] } {
  if (isDeliverectMenuSource(input)) {
    const blockers: string[] = [];
    if (!input.hasOperationalItems) {
      blockers.push("Import or publish a Deliverect menu with available items.");
    }
    return { ready: blockers.length === 0, blockers };
  }

  if (isSquareRoutingMode(input.orderRoutingMode)) {
    const blockers: string[] = [];
    if (!input.hasSquarePublishedMenu) {
      blockers.push("Import and publish a Square catalog menu.");
    } else if (!input.hasOperationalItems) {
      blockers.push("At least one menu item must be available to order.");
    }
    return { ready: blockers.length === 0, blockers };
  }

  const blockers: string[] = [];
  if (!input.hasPublishedMenuVersion) {
    blockers.push("Publish your menu builder draft.");
  }
  if (!input.hasOperationalItems) {
    blockers.push("Add at least one available menu item.");
  }
  return { ready: blockers.length === 0, blockers };
}

function menuSourceCta(
  vendorId: string,
  input: { menuSource: VendorMenuSource; orderRoutingMode: VendorOrderRoutingMode }
): { href: string; label: string } {
  if (isDeliverectMenuSource(input) || isSquareRoutingMode(input.orderRoutingMode)) {
    return { href: `/vendor/${vendorId}/menu/imports`, label: "View menu imports" };
  }
  return { href: vendorMenuManagementPath(vendorId, input.orderRoutingMode), label: "Manage menu" };
}

function buildInactiveProviderCard(input: {
  id: string;
  title: string;
  copy: string;
  vendorId: string;
  ctaHref: string;
  ctaLabel: string;
  health: ProviderConnectionHealth | null | undefined;
}): VendorSetupIntegrationCardView {
  const connected = input.health?.isReady === true;
  const status: VendorSetupIntegrationStatus = connected ? "available" : "not_configured";
  return {
    id: input.id,
    title: input.title,
    status,
    statusLabel: connected ? "Connected" : integrationStatusLabel(status),
    copy: input.copy,
    ctaHref: input.ctaHref,
    ctaLabel: input.ctaLabel,
    blockers: [],
  };
}

export function buildVendorSetupIntegrationsView(input: {
  vendorId: string;
  orderRoutingMode: VendorOrderRoutingMode;
  menuSource: VendorMenuSource;
  readiness: VendorIntegrationReadinessSummary;
  menuReadiness: VendorSetupMenuSourceReadinessInput;
  squareHealth: ProviderConnectionHealth | null;
  deliverectRoutingHealth: ProviderConnectionHealth | null;
}): VendorSetupIntegrationsViewModel {
  const routingHealth = input.readiness.orderRouting?.health;
  const routingReady = routingHealth?.isReady ?? isManualDashboardRoutingMode(input.orderRoutingMode);
  const routingBlockers = routingHealth?.missingRequirements ?? [];
  const routingCta = activeRoutingCta(input.vendorId, input.orderRoutingMode);

  const menuEval = evaluateVendorSetupMenuSourceReadiness(input.menuReadiness);
  const deliverectMenuHealth = input.readiness.menuSource?.health;
  const menuBlockers = isDeliverectMenuSource(input)
    ? deliverectMenuHealth?.missingRequirements ?? menuEval.blockers
    : menuEval.blockers;
  const menuReady = isDeliverectMenuSource(input)
    ? (deliverectMenuHealth?.isReady ?? false) && menuEval.ready
    : menuEval.ready;
  const menuCta = menuSourceCta(input.vendorId, {
    menuSource: input.menuSource,
    orderRoutingMode: input.orderRoutingMode,
  });

  const activeRouting: VendorSetupIntegrationCardView = {
    id: "active-routing",
    title: activeRoutingTitle(input.orderRoutingMode),
    status: routingReady ? "ready" : "needs_attention",
    statusLabel: routingReady ? "Ready" : "Needs attention",
    copy: activeRoutingCopy(input.orderRoutingMode),
    ctaHref: routingCta.href,
    ctaLabel: routingCta.label,
    blockers: routingBlockers,
  };

  const activeMenuSource: VendorSetupIntegrationCardView = {
    id: "active-menu-source",
    title: vendorSetupMenuSourceTitle({
      menuSource: input.menuSource,
      orderRoutingMode: input.orderRoutingMode,
    }),
    status: menuReady ? "ready" : "needs_attention",
    statusLabel: menuReady ? "Ready" : "Needs attention",
    copy: vendorSetupMenuSourceCopy({
      menuSource: input.menuSource,
      orderRoutingMode: input.orderRoutingMode,
    }),
    ctaHref: menuCta.href,
    ctaLabel: menuCta.label,
    blockers: menuBlockers,
  };

  const availableIntegrations: VendorSetupIntegrationCardView[] = [];

  if (!isSquareRoutingMode(input.orderRoutingMode)) {
    availableIntegrations.push(
      buildInactiveProviderCard({
        id: "square",
        title: "Square",
        copy: "Route paid Open Order orders to Square as prepaid pickup orders.",
        vendorId: input.vendorId,
        ctaHref: `/vendor/${input.vendorId}/integrations/square`,
        ctaLabel: "View Square integration",
        health: input.squareHealth,
      })
    );
  }

  if (!isDeliverectRoutingMode(input.orderRoutingMode)) {
    availableIntegrations.push(
      buildInactiveProviderCard({
        id: "deliverect",
        title: "Deliverect",
        copy: "Send orders to Deliverect for POS and kitchen routing where supported.",
        vendorId: input.vendorId,
        ctaHref: `/vendor/${input.vendorId}/connect-pos`,
        ctaLabel: "View Deliverect connection",
        health: input.deliverectRoutingHealth,
      })
    );
  }

  const toastProfile = getToastPlaceholderProfile();
  availableIntegrations.push({
    id: "toast",
    title: toastProfile.displayName,
    status: "not_configured",
    statusLabel: "Coming soon",
    copy: toastProfile.routingDescription,
    ctaHref: null,
    ctaLabel: null,
    blockers: [],
  });

  return {
    activeRouting,
    activeMenuSource,
    availableIntegrations,
  };
}

/** Setup page must not surface inactive provider connection rows as readiness blockers. */
export function vendorSetupPageShowsInactiveProviderAsBlocker(
  orderRoutingMode: VendorOrderRoutingMode,
  inactiveProvider: "square" | "deliverect"
): boolean {
  if (inactiveProvider === "square") {
    return isSquareRoutingMode(orderRoutingMode);
  }
  return isDeliverectRoutingMode(orderRoutingMode);
}

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
  VENDOR_ROUTING_MODE_COPY,
} from "@/lib/vendor-order-routing-mode";
import { isDeliverectMenuSource } from "@/lib/vendor-menu-source";
import { vendorMenuManagementPath } from "@/lib/vendor-menu-management";
import { vendorMayConfigurePosOrderRouting } from "@/lib/vendor-routing-availability";

export type VendorIntegrationsSurface = "setup" | "hub";

export type VendorSetupIntegrationStatus =
  | "ready"
  | "needs_attention"
  | "available"
  | "not_configured";

export type VendorIntegrationAction = {
  href: string;
  label: string;
};

export type VendorSetupIntegrationCardView = {
  id: string;
  title: string;
  status: VendorSetupIntegrationStatus;
  statusLabel: string;
  copy: string;
  actions: VendorIntegrationAction[];
  blockers: string[];
};

export type VendorSetupIntegrationsViewModel = {
  activeRouting: VendorSetupIntegrationCardView;
  activeMenuSource: VendorSetupIntegrationCardView;
  connectedIntegrations: VendorSetupIntegrationCardView[];
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
  if (!vendorMayConfigurePosOrderRouting()) {
    return "Open Order dashboard";
  }
  if (isManualDashboardRoutingMode(orderRoutingMode)) {
    return "Open Order Dashboard / Tablet";
  }
  if (isDeliverectRoutingMode(orderRoutingMode)) {
    return "Deliverect";
  }
  return "Square";
}

function activeRoutingCopy(orderRoutingMode: VendorOrderRoutingMode): string {
  if (!vendorMayConfigurePosOrderRouting()) {
    if (isManualDashboardRoutingMode(orderRoutingMode)) {
      return VENDOR_ROUTING_MODE_COPY.manualDashboard.vendorHelper;
    }
    return "Open Order uses tablet ordering. Orders appear in your Open Order dashboard. Contact Open Order support if your kitchen setup still looks connected to a POS.";
  }
  return getProviderDisplayProfile(orderRoutingMode).routingDescription;
}

function activeRoutingActions(
  vendorId: string,
  orderRoutingMode: VendorOrderRoutingMode,
  surface: VendorIntegrationsSurface
): VendorIntegrationAction[] {
  // Beta tablet-only: never offer POS connect/manage CTAs on vendor surfaces.
  if (!vendorMayConfigurePosOrderRouting() || isManualDashboardRoutingMode(orderRoutingMode)) {
    const actions: VendorIntegrationAction[] = [
      { href: `/vendor/${vendorId}/kitchen`, label: "Open kitchen mode" },
    ];
    if (surface === "hub") {
      actions.push({ href: `/vendor/${vendorId}/dashboard`, label: "Open vendor dashboard" });
    }
    return actions;
  }

  if (isDeliverectRoutingMode(orderRoutingMode)) {
    const actions: VendorIntegrationAction[] = [
      {
        href: `/vendor/${vendorId}/connect-pos`,
        label: surface === "hub" ? "Manage POS settings" : "Manage Deliverect setup",
      },
    ];
    if (surface === "hub") {
      actions.push({ href: `/vendor/${vendorId}/menu/imports`, label: "View menu imports" });
    }
    return actions;
  }

  const actions: VendorIntegrationAction[] = [
    { href: `/vendor/${vendorId}/integrations/square`, label: "Manage Square integration" },
  ];
  if (surface === "hub") {
    actions.push({ href: `/vendor/${vendorId}/menu/imports`, label: "View menu imports" });
  }
  return actions;
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

function menuSourceActions(
  vendorId: string,
  input: { menuSource: VendorMenuSource; orderRoutingMode: VendorOrderRoutingMode },
  surface: VendorIntegrationsSurface
): VendorIntegrationAction[] {
  if (!vendorMayConfigurePosOrderRouting()) {
    // Tablet beta: Menu Builder for supported modes; no POS import management CTAs.
    if (
      isManualDashboardRoutingMode(input.orderRoutingMode) &&
      !isDeliverectMenuSource(input)
    ) {
      return [
        {
          href: vendorMenuManagementPath(vendorId, "manual_dashboard"),
          label: "Manage menu",
        },
      ];
    }
    return [{ href: `/vendor/${vendorId}/kitchen`, label: "Open kitchen mode" }];
  }

  if (isDeliverectMenuSource(input) || isSquareRoutingMode(input.orderRoutingMode)) {
    const actions: VendorIntegrationAction[] = [
      { href: `/vendor/${vendorId}/menu/imports`, label: "View menu imports" },
    ];
    if (surface === "hub" && isDeliverectMenuSource(input)) {
      actions.push({ href: `/vendor/${vendorId}/menu`, label: "Open menu sync" });
    }
    return actions;
  }

  return [
    {
      href: vendorMenuManagementPath(vendorId, input.orderRoutingMode),
      label: surface === "hub" ? "Manage menu" : "Manage menu",
    },
  ];
}

function buildInactiveProviderCard(input: {
  id: string;
  title: string;
  copy: string;
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
    actions: [{ href: input.ctaHref, label: input.ctaLabel }],
    blockers: [],
  };
}

function pushInactiveProviderCard(input: {
  surface: VendorIntegrationsSurface;
  card: VendorSetupIntegrationCardView;
  connected: boolean;
  connectedIntegrations: VendorSetupIntegrationCardView[];
  availableIntegrations: VendorSetupIntegrationCardView[];
}) {
  if (input.surface === "hub" && input.connected) {
    input.connectedIntegrations.push(input.card);
    return;
  }
  input.availableIntegrations.push(input.card);
}

export function buildVendorSetupIntegrationsView(input: {
  vendorId: string;
  orderRoutingMode: VendorOrderRoutingMode;
  menuSource: VendorMenuSource;
  readiness: VendorIntegrationReadinessSummary;
  menuReadiness: VendorSetupMenuSourceReadinessInput;
  squareHealth: ProviderConnectionHealth | null;
  deliverectRoutingHealth: ProviderConnectionHealth | null;
  surface?: VendorIntegrationsSurface;
}): VendorSetupIntegrationsViewModel {
  const surface = input.surface ?? "setup";
  const posSelectable = vendorMayConfigurePosOrderRouting();
  const routingHealth = input.readiness.orderRouting?.health;
  // Beta tablet-only: do not surface POS routing readiness blockers to vendors.
  const routingReady = posSelectable
    ? (routingHealth?.isReady ?? isManualDashboardRoutingMode(input.orderRoutingMode))
    : true;
  const routingBlockers = posSelectable ? (routingHealth?.missingRequirements ?? []) : [];

  const menuEval = evaluateVendorSetupMenuSourceReadiness(input.menuReadiness);
  const deliverectMenuHealth = input.readiness.menuSource?.health;
  const menuBlockers =
    !posSelectable && isManualDashboardRoutingMode(input.orderRoutingMode)
      ? menuEval.blockers
      : isDeliverectMenuSource(input)
        ? deliverectMenuHealth?.missingRequirements ?? menuEval.blockers
        : menuEval.blockers;
  const menuReady =
    !posSelectable && isManualDashboardRoutingMode(input.orderRoutingMode)
      ? menuEval.ready
      : isDeliverectMenuSource(input)
        ? (deliverectMenuHealth?.isReady ?? false) && menuEval.ready
        : menuEval.ready;

  const activeRouting: VendorSetupIntegrationCardView = {
    id: "active-routing",
    title: activeRoutingTitle(input.orderRoutingMode),
    status: routingReady ? "ready" : "needs_attention",
    statusLabel: routingReady ? "Ready" : "Needs attention",
    copy: activeRoutingCopy(input.orderRoutingMode),
    actions: activeRoutingActions(input.vendorId, input.orderRoutingMode, surface),
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
    actions: menuSourceActions(
      input.vendorId,
      { menuSource: input.menuSource, orderRoutingMode: input.orderRoutingMode },
      surface
    ),
    blockers: menuBlockers,
  };

  const connectedIntegrations: VendorSetupIntegrationCardView[] = [];
  const availableIntegrations: VendorSetupIntegrationCardView[] = [];

  // Beta: do not offer inactive POS providers as selectable routing options.
  if (vendorMayConfigurePosOrderRouting()) {
    if (!isSquareRoutingMode(input.orderRoutingMode)) {
      const squareConnected = input.squareHealth?.isReady === true;
      const squareCard = buildInactiveProviderCard({
        id: "square",
        title: "Square",
        copy: "Route paid Open Order orders to Square as prepaid pickup orders.",
        ctaHref: `/vendor/${input.vendorId}/integrations/square`,
        ctaLabel: "View Square integration",
        health: input.squareHealth,
      });
      pushInactiveProviderCard({
        surface,
        card: squareCard,
        connected: squareConnected,
        connectedIntegrations,
        availableIntegrations,
      });
    }

    if (!isDeliverectRoutingMode(input.orderRoutingMode)) {
      const deliverectConnected = input.deliverectRoutingHealth?.isReady === true;
      const deliverectCard = buildInactiveProviderCard({
        id: "deliverect",
        title: "Deliverect",
        copy: "Send orders to Deliverect for POS and kitchen routing where supported.",
        ctaHref: `/vendor/${input.vendorId}/connect-pos`,
        ctaLabel: "View Deliverect connection",
        health: input.deliverectRoutingHealth,
      });
      pushInactiveProviderCard({
        surface,
        card: deliverectCard,
        connected: deliverectConnected,
        connectedIntegrations,
        availableIntegrations,
      });
    }

    const toastProfile = getToastPlaceholderProfile();
    availableIntegrations.push({
      id: "toast",
      title: toastProfile.displayName,
      status: "not_configured",
      statusLabel: "Coming soon",
      copy: toastProfile.routingDescription,
      actions: [],
      blockers: [],
    });
  }

  return {
    activeRouting,
    activeMenuSource,
    connectedIntegrations,
    availableIntegrations,
  };
}

/** Setup/hub pages must not surface inactive provider connection rows as readiness blockers. */
export function vendorSetupPageShowsInactiveProviderAsBlocker(
  orderRoutingMode: VendorOrderRoutingMode,
  inactiveProvider: "square" | "deliverect"
): boolean {
  if (inactiveProvider === "square") {
    return isSquareRoutingMode(orderRoutingMode);
  }
  return isDeliverectRoutingMode(orderRoutingMode);
}

export function inactiveDeliverectConnectionHealth(input: {
  posConnectionStatus: string | null | undefined;
  deliverectChannelLinkId: string | null | undefined;
}): ProviderConnectionHealth {
  const connected =
    input.posConnectionStatus === "connected" && Boolean(input.deliverectChannelLinkId?.trim());
  return {
    provider: "deliverect",
    status: connected ? "connected" : "not_configured",
    isReady: connected,
    missingRequirements: connected ? [] : ["Deliverect is not connected for this vendor"],
    warnings: [],
    lastCheckedAt: new Date(),
  };
}

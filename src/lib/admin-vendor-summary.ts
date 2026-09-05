/**
 * Admin-facing vendor summary — business labels only (no raw IDs / env / OAuth dumps).
 */

import type { BusinessHoursEvaluation } from "@/lib/business-time";
import type { AdminSquareOrderInjectionDiagnostics } from "@/lib/integrations/square/admin-square-order-injection-diagnostics.server";
import type { AdminSquareRoutingStatus } from "@/lib/integrations/square/square-routing-readiness";
import {
  isDeliverectRoutingMode,
  isManualDashboardRoutingMode,
  isSquareRoutingMode,
} from "@/lib/vendor-order-routing-mode";
import {
  resolveVendorDashboardPresenceStatus,
  vendorDashboardPresenceDetail,
} from "@/lib/vendor-dashboard-presence";
import type { AdminVendorDetailView } from "@/services/admin-vendor-detail.service";
import type { VendorPosReadinessSummary } from "@/lib/vendor-readiness-states";
import { ADMIN_AUDIT_ACTION } from "@/lib/admin-audit-log";
import {
  ORDERING_MODE_COPY,
  resolveVendorOrderingIntent,
  VENDOR_ORDERING_MODE_LABELS,
  vendorOrderingModeLabel,
} from "@/lib/vendor-ordering-mode";

export type AdminStatusTone = "success" | "warning" | "danger" | "neutral";

export type AdminVendorAttentionItem = {
  id: string;
  title: string;
  consequence: string;
  actionLabel: string;
  actionHref?: string;
  actionKind?: "link" | "anchor";
  tone: AdminStatusTone;
};

export type AdminVendorOverallStatus =
  | "accepting_orders"
  | "menu_only"
  | "paused"
  | "closed_by_hours"
  | "setup_required"
  | "integration_issue"
  | "hidden";

export type AdminVendorSummary = {
  vendorId: string;
  name: string;
  slug: string;
  publicUrl: string | null;
  podName: string | null;
  podId: string | null;
  overallStatus: {
    key: AdminVendorOverallStatus;
    label: string;
    tone: AdminStatusTone;
    detail?: string;
  };
  routingBadge: {
    label: string;
  };
  visibility: {
    visible: boolean;
    label: string;
  };
  ordering: {
    acceptingOrders: boolean;
    label: string;
    reason?: string;
  };
  /** Durable menu-only vs orderable intent. Separate from `ordering` (live acceptance). */
  orderingMode: {
    vendorOrderingEnabled: boolean;
    podOrderingEnabled: boolean;
    menuOnly: boolean;
    /** Pod-wide switch is off; the vendor's own setting is preserved. */
    menuOnlyByPod: boolean;
    label: string;
    description: string;
  };
  hours: {
    statusLabel: string;
    nextChangeLabel?: string;
    isOpen: boolean;
  };
  menu: {
    statusLabel: string;
    availableItemCount: number;
    lastPublishedLabel?: string | null;
  };
  payments: {
    ready: boolean;
    label: string;
    issue?: string;
  };
  routing: {
    providerLabel: string;
    managedInLabel: string;
    ready: boolean;
    issue?: string;
    summaryLines: string[];
  };
  pod: {
    name: string | null;
    active: boolean;
    label: string;
  };
  dashboard: {
    showAttention: boolean;
    label: string | null;
    detail: string | null;
  };
  attentionItems: AdminVendorAttentionItem[];
  links: {
    vendorDashboard: string;
    publicPage: string | null;
    menuManage: string;
    squareManage: string;
    diagnostics: string;
    ordersFilter: string;
    podAdmin: string | null;
  };
};

function formatWallClockAmPm(hhmm: string | null | undefined): string | null {
  if (!hhmm?.trim()) return null;
  const [hRaw, mRaw] = hhmm.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function formatAdminBusinessHoursStatus(hours: BusinessHoursEvaluation | null | undefined): {
  statusLabel: string;
  nextChangeLabel?: string;
  isOpen: boolean;
} {
  if (!hours) {
    return { statusLabel: "Hours not configured", isOpen: false };
  }
  if (hours.reasonCode === "missing_hours") {
    return { statusLabel: "Hours not configured", isOpen: false };
  }
  if (hours.isOpen) {
    const closes = formatWallClockAmPm(hours.matchedDay?.closeTime);
    return {
      statusLabel: "Open now",
      nextChangeLabel: closes ? `Closes at ${closes}` : undefined,
      isOpen: true,
    };
  }
  const opens = formatWallClockAmPm(hours.matchedDay?.openTime);
  if (hours.reasonCode === "closed_before_open" && opens) {
    return {
      statusLabel: "Closed now",
      nextChangeLabel: `Opens today at ${opens}`,
      isOpen: false,
    };
  }
  const day =
    hours.matchedDay?.day != null
      ? hours.matchedDay.day.charAt(0).toUpperCase() + hours.matchedDay.day.slice(1)
      : null;
  return {
    statusLabel: "Closed now",
    nextChangeLabel:
      day && opens ? `Opens ${day} at ${opens}` : hours.reasonDetail || undefined,
    isOpen: false,
  };
}

export function adminVendorRoutingManagedLabel(mode: string): string {
  if (isSquareRoutingMode(mode)) return "Managed in Square";
  if (isDeliverectRoutingMode(mode)) return "Managed through Deliverect";
  return "Managed in Open Order";
}

export function adminVendorPrimaryOrderState(input: {
  routingStatus: string;
  fulfillmentStatus: string;
}): { label: string; tone: AdminStatusTone } {
  const { routingStatus, fulfillmentStatus } = input;
  if (fulfillmentStatus === "cancelled") {
    return { label: "Cancelled", tone: "neutral" };
  }
  if (routingStatus === "failed") {
    if (fulfillmentStatus === "completed") {
      return { label: "Completed with routing issue", tone: "warning" };
    }
    return { label: "Routing failed", tone: "danger" };
  }
  if (fulfillmentStatus === "completed") {
    return { label: "Completed", tone: "success" };
  }
  if (fulfillmentStatus === "ready") {
    return { label: "Ready for pickup", tone: "success" };
  }
  if (
    fulfillmentStatus === "preparing" ||
    fulfillmentStatus === "accepted" ||
    routingStatus === "confirmed" ||
    routingStatus === "sent"
  ) {
    return { label: "In progress", tone: "neutral" };
  }
  return { label: "In progress", tone: "neutral" };
}

const AUDIT_LABELS: Record<string, string> = {
  [ADMIN_AUDIT_ACTION.UNCLAIMED_VENDOR_CREATED]: "Unclaimed vendor created",
  [ADMIN_AUDIT_ACTION.VENDOR_CLAIM_INVITE_SENT]: "Claim invitation sent",
  [ADMIN_AUDIT_ACTION.VENDOR_CLAIM_INVITE_RESENT]: "Claim invitation resent",
  [ADMIN_AUDIT_ACTION.VENDOR_CLAIM_INVITE_REVOKED]: "Claim invitation revoked",
  [ADMIN_AUDIT_ACTION.VENDOR_CLAIMED]: "Vendor claimed",
  [ADMIN_AUDIT_ACTION.VENDOR_ORDERING_PAUSED]: "Ordering paused",
  [ADMIN_AUDIT_ACTION.VENDOR_ORDERING_UNPAUSED]: "Ordering resumed",
  [ADMIN_AUDIT_ACTION.VENDOR_HIDDEN]: "Vendor hidden from public listing",
  [ADMIN_AUDIT_ACTION.VENDOR_SHOWN]: "Vendor shown on public listing",
  [ADMIN_AUDIT_ACTION.VENDOR_DELETED]: "Vendor deleted",
  [ADMIN_AUDIT_ACTION.VENDOR_PUBLIC_PROFILE_UPDATED]: "Public profile updated",
  [ADMIN_AUDIT_ACTION.VENDOR_ATTACHED_TO_POD]: "Added to a pod",
  [ADMIN_AUDIT_ACTION.VENDOR_DETACHED_FROM_POD]: "Removed from a pod",
  [ADMIN_AUDIT_ACTION.VENDOR_MOVED_TO_POD]: "Moved to another pod",
  [ADMIN_AUDIT_ACTION.POD_VENDOR_ATTACHED]: "Added to pod",
  [ADMIN_AUDIT_ACTION.POD_VENDOR_DETACHED]: "Removed from pod",
  [ADMIN_AUDIT_ACTION.VENDOR_ORDER_ROUTING_MODE_UPDATED]: "Order routing method changed",
  [ADMIN_AUDIT_ACTION.VENDOR_MENU_REFRESH_REQUESTED]: "Menu refresh requested",
  [ADMIN_AUDIT_ACTION.VENDOR_READINESS_RECHECKED]: "Readiness rechecked",
  [ADMIN_AUDIT_ACTION.SLUG_CHANGED]: "Public URL slug changed",
  [ADMIN_AUDIT_ACTION.SLUG_RESTORED]: "Previous public slug restored",
  [ADMIN_AUDIT_ACTION.SQUARE_LOCATION_CHANGED]: "Square location changed",
  [ADMIN_AUDIT_ACTION.SQUARE_STALE_MAPPINGS_DEACTIVATED]:
    "Stale Square mappings deactivated",
  [ADMIN_AUDIT_ACTION.POD_ORDERING_PAUSED]: "Ordering paused",
  [ADMIN_AUDIT_ACTION.POD_ORDERING_UNPAUSED]: "Ordering resumed",
  [ADMIN_AUDIT_ACTION.POD_HIDDEN]: "Pod hidden from public listing",
  [ADMIN_AUDIT_ACTION.POD_SHOWN]: "Pod shown on public listing",
  [ADMIN_AUDIT_ACTION.POD_DELETED]: "Pod deleted",
  [ADMIN_AUDIT_ACTION.POD_PUBLIC_PROFILE_UPDATED]: "Pod profile updated",
  [ADMIN_AUDIT_ACTION.POD_READINESS_RECHECKED]: "Readiness rechecked",
  [ADMIN_AUDIT_ACTION.POD_OWNER_ACCESS_ADDED]: "Pod owner access updated",
  [ADMIN_AUDIT_ACTION.POD_OWNER_ACCESS_REMOVED]: "Pod owner access updated",
  [ADMIN_AUDIT_ACTION.POD_OWNER_TRANSFERRED]: "Pod owner access updated",
};

export function formatAdminAuditActionLabel(
  actionType: string,
  meta?: { newValue?: string | null; podName?: string | null }
): string {
  if (actionType === ADMIN_AUDIT_ACTION.VENDOR_ORDER_ROUTING_MODE_UPDATED && meta?.newValue) {
    const mode = meta.newValue.split("/")[0]?.trim() ?? meta.newValue;
    if (isSquareRoutingMode(mode)) return "Order routing changed to Square";
    if (isDeliverectRoutingMode(mode)) return "Order routing changed to Deliverect";
    if (isManualDashboardRoutingMode(mode)) return "Order routing changed to Open Order";
    return `Order routing changed (${meta.newValue})`;
  }
  if (
    (actionType === ADMIN_AUDIT_ACTION.VENDOR_ATTACHED_TO_POD ||
      actionType === ADMIN_AUDIT_ACTION.POD_VENDOR_ATTACHED ||
      actionType === ADMIN_AUDIT_ACTION.VENDOR_MOVED_TO_POD) &&
    meta?.podName
  ) {
    return `Added to ${meta.podName}`;
  }
  return AUDIT_LABELS[actionType] ?? actionType.replaceAll("_", " ").toLowerCase();
}

function paymentsReady(detail: AdminVendorDetailView): boolean {
  return Boolean(
    detail.vendor.stripeConnectedAccountId?.trim() &&
      detail.vendor.stripeChargesEnabled &&
      detail.vendor.stripePayoutsEnabled
  );
}

export function buildAdminVendorSummary(input: {
  detail: AdminVendorDetailView;
  posSummary: VendorPosReadinessSummary | null;
  squareStatus: AdminSquareRoutingStatus;
  squareInjectionDiagnostics: AdminSquareOrderInjectionDiagnostics | null;
  hoursDebug: BusinessHoursEvaluation | null;
}): AdminVendorSummary {
  const { detail, squareStatus, squareInjectionDiagnostics, hoursDebug } = input;
  const mode = detail.vendor.orderRoutingMode;
  const vendorId = detail.vendor.id;
  const primaryPod = detail.pods[0] ?? null;
  const hours = formatAdminBusinessHoursStatus(hoursDebug);
  const payReady = paymentsReady(detail);
  /**
   * Menu-only is intentional, so commerce prerequisites (Stripe, Square, Deliverect, kitchen
   * presence) are not surfaced as attention items while ordering intent is off.
   */
  const intent = resolveVendorOrderingIntent({
    podOrderingEnabled: primaryPod?.podOrderingEnabled,
    vendorOrderingEnabled: detail.vendor.orderingEnabled,
  });
  const showCommerceAttention = intent.effectiveOrderingEnabled;
  const coverage = squareInjectionDiagnostics?.vendor.mappingCoverage;
  const squarePrereqReady =
    squareInjectionDiagnostics?.vendor.prerequisitesReady === true;
  const squareReady =
    isSquareRoutingMode(mode) &&
    squareStatus.hasConnection &&
    (coverage ? coverage.ready : squarePrereqReady) &&
    squarePrereqReady;

  const attentionItems: AdminVendorAttentionItem[] = [];

  if (detail.vendor.deletedAt || !detail.vendor.isActive) {
    attentionItems.push({
      id: "hidden",
      title: "Vendor is hidden",
      consequence: "Customers cannot find or order from this vendor on the pod page.",
      actionLabel: "Review visibility",
      actionHref: "#advanced-settings",
      actionKind: "anchor",
      tone: "danger",
    });
  }

  if (detail.vendor.mennyuOrdersPaused && showCommerceAttention) {
    attentionItems.push({
      id: "paused",
      title: "Ordering is paused",
      consequence: "Customers cannot place new orders until ordering is resumed.",
      actionLabel: "Resume ordering",
      actionHref: "#ordering-controls",
      actionKind: "anchor",
      tone: "warning",
    });
  }

  if (!payReady && showCommerceAttention) {
    attentionItems.push({
      id: "stripe",
      title: "Payment setup needs attention",
      consequence: "This vendor cannot accept paid orders until payouts are ready.",
      actionLabel: "Review payment setup",
      actionHref: "#advanced-settings",
      actionKind: "anchor",
      tone: "warning",
    });
  }

  if (isSquareRoutingMode(mode) && showCommerceAttention) {
    if (!squareStatus.hasConnection || !squareStatus.health.isReady) {
      attentionItems.push({
        id: "square-disconnected",
        title: "Square is not connected",
        consequence: "Paid orders cannot be sent to Square until the connection is restored.",
        actionLabel: "Review Square setup",
        actionHref: `/vendor/${vendorId}/integrations/square`,
        actionKind: "link",
        tone: "danger",
      });
    } else if (squareStatus.missingRequirements.some((m) => /location/i.test(m))) {
      attentionItems.push({
        id: "square-location",
        title: "Square location must be selected",
        consequence: "Orders need an active Square location before they can be routed.",
        actionLabel: "Select Square location",
        actionHref: `/vendor/${vendorId}/integrations/square`,
        actionKind: "link",
        tone: "warning",
      });
    } else if (coverage && !coverage.ready) {
      const otherLoc = coverage.mappingsExistForAnotherLocation;
      attentionItems.push({
        id: "square-coverage",
        title: otherLoc
          ? "Square menu needs attention"
          : "Square menu coverage is incomplete",
        consequence: otherLoc
          ? "This vendor has mappings from a previous Square location. New orders use the selected location."
          : `${coverage.mappedSellableItems} of ${coverage.totalSellableItems} sellable items are ready for the selected location.`,
        actionLabel: "Review Square setup",
        actionHref: `/vendor/${vendorId}/integrations/square`,
        actionKind: "link",
        tone: "warning",
      });
    } else if (
      squareInjectionDiagnostics &&
      squareInjectionDiagnostics.vendor.publishedSquareImportedMenu === "missing"
    ) {
      attentionItems.push({
        id: "square-menu-import",
        title: "Square menu needs to be imported",
        consequence: "Import and publish a Square menu before customers can order.",
        actionLabel: "Manage Square menu",
        actionHref: `/vendor/${vendorId}/menu/imports`,
        actionKind: "link",
        tone: "warning",
      });
    }
  }

  if (
    isDeliverectRoutingMode(mode) &&
    detail.vendor.posConnectionStatus !== "connected" &&
    showCommerceAttention
  ) {
    attentionItems.push({
      id: "deliverect",
      title: "Deliverect connection needs attention",
      consequence: "Orders may not reach the kitchen POS until Deliverect is connected.",
      actionLabel: "Review Deliverect mapping",
      actionHref: `/admin/vendors/${vendorId}/deliverect-mapping`,
      actionKind: "link",
      tone: "warning",
    });
  }

  const recentRoutingFail = detail.recentOrders.find((o) => o.routingStatus === "failed");
  if (recentRoutingFail) {
    attentionItems.push({
      id: "recent-routing-fail",
      title: "A recent order failed to route",
      consequence: "Review the order to recover the vendor ticket or confirm kitchen status.",
      actionLabel: "Open recent order",
      actionHref: `/admin/orders/${recentRoutingFail.id}`,
      actionKind: "link",
      tone: "danger",
    });
  }

  const presence = resolveVendorDashboardPresenceStatus(detail.vendor.vendorDashboardLastSeenAt);
  const showDashboardAttention =
    isManualDashboardRoutingMode(mode) && presence === "offline" && showCommerceAttention;
  if (showDashboardAttention) {
    attentionItems.push({
      id: "dashboard-offline",
      title: "Vendor dashboard offline",
      consequence: "Open Order kitchen staff may not see new orders until the dashboard is open.",
      actionLabel: "Open vendor dashboard",
      actionHref: `/vendor/${vendorId}/dashboard`,
      actionKind: "link",
      tone: "warning",
    });
  }

  let overallKey: AdminVendorOverallStatus = "accepting_orders";
  let overallLabel = "Accepting orders";
  let overallTone: AdminStatusTone = "success";

  if (detail.vendor.deletedAt || !detail.vendor.isActive) {
    overallKey = "hidden";
    overallLabel = "Hidden";
    overallTone = "danger";
  } else if (intent.menuOnly) {
    /** Not a failure: the menu is public and browsable, ordering is intentionally off. */
    overallKey = "menu_only";
    overallLabel = intent.menuOnlyByVendor
      ? VENDOR_ORDERING_MODE_LABELS.menu_only
      : VENDOR_ORDERING_MODE_LABELS.menu_only_pod_disabled;
    overallTone = "neutral";
  } else if (detail.vendor.mennyuOrdersPaused) {
    overallKey = "paused";
    overallLabel = "Paused";
    overallTone = "warning";
  } else if (
    attentionItems.some((i) =>
      ["square-disconnected", "square-location", "square-coverage", "square-menu-import", "deliverect"].includes(
        i.id
      )
    )
  ) {
    overallKey = "integration_issue";
    overallLabel = "Integration issue";
    overallTone = "danger";
  } else if (!payReady || !detail.readinessSummary.canAcceptOrders) {
    overallKey = "setup_required";
    overallLabel = "Setup required";
    overallTone = "warning";
  } else if (!hours.isOpen) {
    overallKey = "closed_by_hours";
    overallLabel = "Closed by hours";
    overallTone = "neutral";
  }

  const acceptingOrders =
    overallKey === "accepting_orders" && detail.readinessSummary.canAcceptOrders;

  const locationName = squareStatus.locationName?.trim() || null;
  const mapped = coverage?.mappedSellableItems ?? 0;
  const total = coverage?.totalSellableItems ?? 0;

  let routingSummaryLines: string[] = [];
  let routingIssue: string | undefined;
  if (intent.menuOnly) {
    /**
     * Routing configuration is preserved but not validated while menu-only: showing
     * "Action required" here would frame an intentional state as a broken integration.
     */
    routingSummaryLines = [`${adminVendorRoutingManagedLabel(mode)} · not used while menu only`];
  } else if (isSquareRoutingMode(mode)) {
    if (squareReady && coverage?.ready) {
      routingSummaryLines = [
        "Connected",
        locationName ? `Location: ${locationName}` : "Location selected",
        total > 0 ? `Menu: ${mapped} of ${total} items ready` : "Menu ready",
        "Orders: Managed in Square",
      ];
    } else if (coverage && !coverage.ready && total > 0) {
      routingIssue = `${Math.max(total - mapped, 0)} menu items are not ready for the selected Square location.`;
      routingSummaryLines = ["Action required", routingIssue];
    } else {
      routingIssue = squareStatus.statusMessage;
      routingSummaryLines = ["Action required", routingIssue];
    }
  } else if (isDeliverectRoutingMode(mode)) {
    routingSummaryLines = [
      detail.vendor.posConnectionStatus === "connected" ? "Connected" : "Action required",
      "Orders route through Deliverect",
    ];
  } else {
    routingSummaryLines = ["Orders managed in the Open Order dashboard"];
  }

  return {
    vendorId,
    name: detail.vendor.name,
    slug: detail.vendor.slug,
    publicUrl: primaryPod?.publicPath ?? detail.vendor.publicPathPreview,
    podName: primaryPod?.podName ?? null,
    podId: primaryPod?.podId ?? null,
    overallStatus: {
      key: overallKey,
      label: overallLabel,
      tone: overallTone,
      detail: acceptingOrders ? undefined : detail.readinessSummary.label,
    },
    routingBadge: { label: adminVendorRoutingManagedLabel(mode) },
    visibility: {
      visible: detail.vendor.isActive && !detail.vendor.deletedAt,
      label:
        detail.vendor.deletedAt
          ? "Deleted"
          : detail.vendor.isActive
            ? "Visible"
            : "Hidden",
    },
    ordering: {
      acceptingOrders,
      label: intent.menuOnly
        ? VENDOR_ORDERING_MODE_LABELS.menu_only
        : detail.vendor.mennyuOrdersPaused
          ? "Ordering paused"
          : acceptingOrders
            ? "Accepting orders"
            : !hours.isOpen
              ? "Closed by hours"
              : "Not accepting orders",
      reason: intent.menuOnly || acceptingOrders ? undefined : detail.readinessSummary.label,
    },
    orderingMode: {
      vendorOrderingEnabled: intent.vendorOrderingEnabled,
      podOrderingEnabled: intent.podOrderingEnabled,
      menuOnly: intent.menuOnly,
      menuOnlyByPod: intent.menuOnlyByPod && intent.vendorOrderingEnabled,
      label: vendorOrderingModeLabel({
        podOrderingEnabled: intent.podOrderingEnabled,
        vendorOrderingEnabled: intent.vendorOrderingEnabled,
        orderingReady: payReady,
      }),
      description: intent.vendorOrderingEnabled
        ? ORDERING_MODE_COPY.vendorEnabledDescription
        : ORDERING_MODE_COPY.vendorMenuOnlyDescription,
    },
    hours: {
      statusLabel: hours.statusLabel,
      nextChangeLabel: hours.nextChangeLabel,
      isOpen: hours.isOpen,
    },
    menu: {
      statusLabel: detail.menuSync.hasPublishedMenu
        ? "Published"
        : detail.menuSync.hasDraftAwaitingReview
          ? "Draft awaiting review"
          : "Unpublished",
      availableItemCount: detail.menuSync.visibleItems,
      lastPublishedLabel: detail.menuSync.lastSuccessAt
        ? new Date(detail.menuSync.lastSuccessAt).toLocaleString()
        : null,
    },
    payments: {
      ready: payReady,
      label: payReady
        ? "Ready"
        : intent.menuOnly
          ? "Not required — menu only"
          : "Action required",
      /** Menu-only vendors are never nagged about payouts they do not need yet. */
      issue: payReady || intent.menuOnly ? undefined : "Stripe payouts are not fully enabled.",
    },
    routing: {
      providerLabel: isSquareRoutingMode(mode)
        ? "Square"
        : isDeliverectRoutingMode(mode)
          ? "Deliverect"
          : "Open Order",
      managedInLabel: adminVendorRoutingManagedLabel(mode),
      ready: intent.menuOnly
        ? true
        : isSquareRoutingMode(mode)
        ? Boolean(squareReady && coverage?.ready !== false)
        : isDeliverectRoutingMode(mode)
          ? detail.vendor.posConnectionStatus === "connected"
          : true,
      issue: routingIssue,
      summaryLines: routingSummaryLines,
    },
    pod: {
      name: primaryPod?.podName ?? null,
      active: primaryPod?.podVendorActive ?? false,
      label: primaryPod
        ? primaryPod.podVendorActive
          ? `Active in ${primaryPod.podName}`
          : `Paused in ${primaryPod.podName}`
        : "Not attached to a pod",
    },
    dashboard: {
      showAttention: showDashboardAttention,
      label: showDashboardAttention ? "Vendor dashboard offline" : null,
      detail: showDashboardAttention
        ? vendorDashboardPresenceDetail(detail.vendor.vendorDashboardLastSeenAt)
        : null,
    },
    attentionItems,
    links: {
      vendorDashboard: `/vendor/${vendorId}/dashboard`,
      publicPage: primaryPod?.publicPath ?? null,
      menuManage: isSquareRoutingMode(mode)
        ? `/vendor/${vendorId}/menu/imports`
        : isDeliverectRoutingMode(mode)
          ? `/admin/vendors/${vendorId}/menu-history`
          : `/vendor/${vendorId}/menu`,
      squareManage: `/vendor/${vendorId}/integrations/square`,
      diagnostics: `/admin/vendors/${vendorId}/diagnostics`,
      ordersFilter: `/admin/orders?vendorId=${encodeURIComponent(vendorId)}`,
      podAdmin: primaryPod ? `/admin/pods/${primaryPod.podId}` : null,
    },
  };
}

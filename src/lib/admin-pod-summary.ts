/**
 * Admin-facing pod summary — business labels only (no raw IDs / readiness dumps).
 */

import type { AdminDetailStatusTone } from "@/components/admin/AdminDetailUi";
import { formatAdminAuditActionLabel } from "@/lib/admin-vendor-summary";
import { vendorAvailabilityWithCustomerOrderingHours } from "@/lib/vendor-customer-ordering-hours";
import {
  getVendorOperationalMissingItems,
  getVendorOrderabilityState,
} from "@/lib/vendor-readiness-states";
import { getVendorOrderabilityInPod } from "@/lib/vendor-orderability-in-pod";
import type { AdminPodDetailView } from "@/services/admin-pod-detail.service";
import type { VendorReadinessBundle } from "@/lib/vendor-readiness-validation.server";
import {
  deriveAdminOrderIssueAttention,
  historicalFailedVendorReceiveDetail,
} from "@/lib/admin-order-issue-attention";
import {
  isSquareRoutingMode,
  vendorOrderRoutingModeShortLabel,
} from "@/lib/vendor-order-routing-mode";
import {
  ORDERING_MODE_COPY,
  resolveVendorOrderingIntent,
  VENDOR_ORDERING_MODE_LABELS,
} from "@/lib/vendor-ordering-mode";

export type AdminPodAttentionItem = {
  id: string;
  title: string;
  consequence: string;
  actionLabel: string;
  actionHref?: string;
  actionKind?: "link" | "anchor";
  tone: AdminDetailStatusTone;
};

export type AdminPodOverallStatus =
  | "open"
  | "menu_only"
  | "closed_by_hours"
  | "paused"
  | "setup_required"
  | "hidden"
  | "no_orderable_vendors"
  | "operational_issue";

export type AdminPodVendorRowStatus =
  | "accepting_orders"
  | "menu_only"
  | "menu_only_pod_disabled"
  | "closed_by_hours"
  | "paused"
  | "setup_required"
  | "routing_issue"
  | "hidden";

export type AdminPodVendorRow = {
  vendorId: string;
  name: string;
  slug: string;
  cuisineLabel: string | null;
  visibilityLabel: string;
  statusKey: AdminPodVendorRowStatus;
  statusLabel: string;
  routingLabel: string;
  issueLabel: string | null;
  tone: AdminDetailStatusTone;
};

export type AdminPodSummary = {
  podId: string;
  name: string;
  slug: string;
  publicUrl: string;
  publicPath: string;
  locationLabel: string | null;
  overallStatus: {
    key: AdminPodOverallStatus;
    label: string;
    tone: AdminDetailStatusTone;
    detail?: string;
  };
  secondaryBadge: { label: string } | null;
  visibility: { visible: boolean; label: string };
  ordering: {
    acceptingOrders: boolean;
    label: string;
    detail?: string;
  };
  /** Durable pod-wide menu-only vs orderable intent. Separate from pause. */
  orderingMode: {
    podOrderingEnabled: boolean;
    /** Pod switch is off, or every attached vendor is individually menu-only. */
    effectivelyMenuOnly: boolean;
    label: string;
    description: string;
  };
  hours: {
    statusLabel: string;
    nextChangeLabel?: string;
  };
  profile: {
    complete: boolean;
    label: string;
    missingFields: string[];
  };
  vendors: {
    totalAttached: number;
    visible: number;
    orderable: number;
    /** Visible and browsable but intentionally not orderable. Not a failure. */
    menuOnly: number;
    open: number;
    hidden: number;
    needsAttention: number;
  };
  orders: {
    recentNeedsAttention: number;
    label: string;
  };
  access: {
    configured: boolean;
    ownerLabel: string | null;
    label: string;
  };
  qr: {
    stale: boolean;
  };
  vendorRows: AdminPodVendorRow[];
  attentionItems: AdminPodAttentionItem[];
  links: {
    podDashboard: string;
    publicPage: string;
    ordersFilter: string;
    qrPage: string;
    payoutsPage: string;
    diagnostics: string;
    hoursSettings: string;
  };
};

export { formatAdminAuditActionLabel };

export function adminPodPrimaryOrderState(input: {
  status: string;
  vendorOrders: Array<{
    routingStatus: string;
    fulfillmentStatus: string;
    /** When present, drives Needs attention from active issues (not routingStatus alone). */
    issues?: Array<{ status: string; type: string }>;
  }>;
  /** Parent OrderIssue rows when available. */
  orderIssues?: Array<{ status: string; submittedByRole?: string | null; type?: string }>;
}): { label: string; tone: AdminDetailStatusTone; detail?: string } {
  const { status, vendorOrders, orderIssues } = input;
  if (status === "cancelled" || status === "refunded") {
    return { label: "Cancelled", tone: "neutral" };
  }

  const failed = vendorOrders.filter((vo) => vo.routingStatus === "failed").length;
  const ready = vendorOrders.filter((vo) => vo.fulfillmentStatus === "ready").length;
  const completed = vendorOrders.filter((vo) => vo.fulfillmentStatus === "completed").length;
  const cancelled = vendorOrders.filter((vo) => vo.fulfillmentStatus === "cancelled").length;
  const total = vendorOrders.length;

  const issueAttention = deriveAdminOrderIssueAttention({
    vendorOrderIssues: vendorOrders.flatMap((vo) => vo.issues ?? []),
    orderIssues,
  });
  const failureDetail = historicalFailedVendorReceiveDetail(vendorOrders, {
    resolved: issueAttention.hasResolvedIssueHistory && !issueAttention.hasActiveIssues,
  });

  // Source of truth: active tracked issues — not routingStatus === "failed" alone.
  if (issueAttention.hasActiveIssues) {
    return {
      label: "Needs attention",
      tone: "danger",
      detail:
        failureDetail ??
        (issueAttention.activeCount === 1
          ? "1 open issue"
          : `${issueAttention.activeCount} open issues`),
    };
  }

  if (total > 0 && completed === total) {
    return {
      label: "Completed",
      tone: "success",
      detail: failureDetail,
    };
  }
  if (total > 0 && completed + cancelled === total && completed > 0) {
    return {
      label: issueAttention.hasResolvedIssueHistory ? "Resolved" : "Completed",
      tone: "success",
      detail: failureDetail,
    };
  }
  if (total > 0 && cancelled === total) {
    return { label: "Cancelled", tone: "neutral", detail: failureDetail };
  }
  if (total > 0 && ready === total) {
    return { label: "Ready for pickup", tone: "success", detail: failureDetail };
  }
  if (total > 1 && ready > 0 && ready < total) {
    return { label: "Partially ready", tone: "warning", detail: failureDetail };
  }
  if (issueAttention.hasResolvedIssueHistory && failed > 0) {
    return {
      label: "Resolved",
      tone: "neutral",
      detail: failureDetail,
    };
  }
  if (status === "paid" || status === "submitted" || vendorOrders.some((vo) => vo.routingStatus === "sent" || vo.routingStatus === "confirmed")) {
    return { label: "In progress", tone: "neutral", detail: failureDetail };
  }
  return { label: "In progress", tone: "neutral", detail: failureDetail };
}

function profileMissingFields(pod: AdminPodDetailView["pod"]): string[] {
  const missing: string[] = [];
  if (!pod.name?.trim()) missing.push("name");
  if (!pod.description?.trim()) missing.push("description");
  if (!pod.address?.trim()) missing.push("address");
  if (!pod.imageUrl?.trim()) missing.push("banner image");
  if (!pod.slug?.trim()) missing.push("public slug");
  return missing;
}

function vendorStatusFromEvaluation(input: {
  visible: boolean;
  orderable: boolean;
  paused: boolean;
  closedByHours: boolean;
  routingIssue: boolean;
  setupBlocked: boolean;
  menuOnlyByVendor: boolean;
  menuOnlyByPod: boolean;
}): { key: AdminPodVendorRowStatus; label: string; tone: AdminDetailStatusTone; issueLabel: string | null } {
  if (!input.visible) {
    return { key: "hidden", label: "Hidden", tone: "neutral", issueLabel: null };
  }
  /** Menu-only outranks pause/hours/setup: it is why ordering is off, and it is intentional. */
  if (input.menuOnlyByVendor) {
    return {
      key: "menu_only",
      label: VENDOR_ORDERING_MODE_LABELS.menu_only,
      tone: "neutral",
      issueLabel: null,
    };
  }
  if (input.menuOnlyByPod) {
    return {
      key: "menu_only_pod_disabled",
      label: VENDOR_ORDERING_MODE_LABELS.menu_only_pod_disabled,
      tone: "neutral",
      issueLabel: null,
    };
  }
  if (input.paused) {
    return { key: "paused", label: "Paused", tone: "warning", issueLabel: "Ordering paused" };
  }
  if (input.routingIssue) {
    return {
      key: "routing_issue",
      label: "Routing issue",
      tone: "danger",
      issueLabel: "Routing not ready",
    };
  }
  if (input.setupBlocked) {
    return {
      key: "setup_required",
      label: "Setup required",
      tone: "warning",
      issueLabel: "Setup incomplete",
    };
  }
  if (input.closedByHours) {
    return {
      key: "closed_by_hours",
      label: "Closed by hours",
      tone: "neutral",
      issueLabel: null,
    };
  }
  if (input.orderable) {
    return { key: "accepting_orders", label: "Accepting orders", tone: "success", issueLabel: null };
  }
  return {
    key: "setup_required",
    label: "Setup required",
    tone: "warning",
    issueLabel: "Not accepting orders",
  };
}

export function buildAdminPodSummary(input: {
  detail: AdminPodDetailView;
  readinessByVendorId: Map<string, VendorReadinessBundle>;
  hasPayoutIssues?: boolean;
}): AdminPodSummary {
  const { detail, readinessByVendorId } = input;
  const podId = detail.pod.id;
  const pickupTimezone = detail.pod.pickupTimezone;

  let visible = 0;
  let orderable = 0;
  let menuOnlyCount = 0;
  let open = 0;
  let hidden = 0;
  let needsAttention = 0;
  let closedByHoursCount = 0;

  const podOrderingEnabled = detail.pod.orderingEnabled !== false;

  const vendorRows: AdminPodVendorRow[] = detail.vendors.map((v) => {
    const bundle = readinessByVendorId.get(v.vendorId);
    const vendorAvailability = vendorAvailabilityWithCustomerOrderingHours(
      {
        isActive: v.vendorActive,
        mennyuOrdersPaused: v.mennyuOrdersPaused,
        customerOrderingHours: v.customerOrderingHours,
        syncCustomerOrderingHoursFromDeliverect: false,
        deliverectSyncedCustomerOrderingHours: null,
      },
      pickupTimezone
    );

    const evaluation = bundle
      ? {
          vendor: {
            isActive: v.vendorActive && !v.deletedAt,
            mennyuOrdersPaused: v.mennyuOrdersPaused,
            orderingEnabled: v.orderingEnabled,
            name: v.vendorName,
            slug: v.vendorSlug,
            description: v.description,
            imageUrl: v.imageUrl,
            cuisineCategory: v.cuisineCategory,
            customerOrderingHours: v.customerOrderingHours,
          },
          menuSummary: bundle.menuSummary,
          stripeSummary: bundle.stripeSummary,
          posSummary: bundle.posSummary,
          pod: {
            isActive: detail.pod.isActive && !detail.pod.deletedAt,
            mennyuOrdersPaused: detail.pod.mennyuOrdersPaused,
            orderingEnabled: podOrderingEnabled,
          },
          podVendor: { exists: true, isActive: v.podVendorActive },
          vendorAvailability,
        }
      : null;

    const intent = resolveVendorOrderingIntent({
      podOrderingEnabled,
      vendorOrderingEnabled: v.orderingEnabled,
    });
    const state = evaluation ? getVendorOrderabilityState(evaluation) : null;
    const shallowOrderable = getVendorOrderabilityInPod({
      podActive: detail.pod.isActive && !detail.pod.deletedAt,
      podOrdersPaused: detail.pod.mennyuOrdersPaused,
      podOrderingEnabled,
      vendorOrderingEnabled: v.orderingEnabled,
      podVendorExists: true,
      podVendorActive: v.podVendorActive,
      vendor: {
        isActive: v.vendorActive && !v.deletedAt,
        mennyuOrdersPaused: v.mennyuOrdersPaused,
        posOpen: vendorAvailability.posOpen,
      },
    }).orderable;

    const isVisible = evaluation
      ? state?.visibility === "visible"
      : v.vendorActive && v.podVendorActive && !v.deletedAt && detail.pod.isActive && !detail.pod.deletedAt;
    const isOrderable = evaluation ? Boolean(state?.orderable) : shallowOrderable;
    const missing = evaluation ? getVendorOperationalMissingItems(evaluation) : [];
    /**
     * Menu-only suppresses hours, pause, setup, and routing findings: none of them apply
     * while the vendor is deliberately not selling, and surfacing them would make an
     * intentional configuration look like a broken one.
     */
    const isMenuOnly = isVisible && intent.menuOnly;
    const closedByHours =
      isVisible &&
      !isMenuOnly &&
      !v.mennyuOrdersPaused &&
      (missing.includes("outside_hours") ||
        (!evaluation && vendorAvailability.posOpen === false && shallowOrderable === false));
    const setupBlocked =
      isVisible &&
      !isMenuOnly &&
      !isOrderable &&
      !closedByHours &&
      !v.mennyuOrdersPaused &&
      (evaluation
        ? missing.some((m) => m !== "outside_hours" && m !== "vendor_paused")
        : true);
    const routingIssue =
      isVisible &&
      !isMenuOnly &&
      isSquareRoutingMode(v.orderRoutingMode) &&
      bundle != null &&
      bundle.posSummary.squareOrderRoutingReady === false;

    if (isVisible) visible += 1;
    else hidden += 1;
    if (isOrderable) {
      orderable += 1;
      open += 1;
    }
    if (isMenuOnly) menuOnlyCount += 1;
    if (closedByHours) closedByHoursCount += 1;
    if (isVisible && (setupBlocked || routingIssue || (v.mennyuOrdersPaused && !isMenuOnly))) {
      needsAttention += 1;
    }

    const status = vendorStatusFromEvaluation({
      visible: isVisible,
      orderable: isOrderable,
      paused: isVisible && v.mennyuOrdersPaused,
      closedByHours,
      routingIssue,
      setupBlocked: setupBlocked || routingIssue,
      menuOnlyByVendor: isMenuOnly && intent.menuOnlyByVendor,
      menuOnlyByPod: isMenuOnly && intent.menuOnlyByPod,
    });

    return {
      vendorId: v.vendorId,
      name: v.vendorName,
      slug: v.vendorSlug,
      cuisineLabel: v.cuisineCategory?.trim() || null,
      visibilityLabel: isVisible ? "Visible" : "Hidden",
      statusKey: status.key,
      statusLabel: status.label,
      routingLabel: (() => {
        const short = vendorOrderRoutingModeShortLabel(v.orderRoutingMode);
        return short === "Manual dashboard" ? "Open Order" : short;
      })(),
      issueLabel: status.issueLabel,
      tone: status.tone,
    };
  });

  const missingProfile = profileMissingFields(detail.pod);
  const profileComplete = missingProfile.length === 0;
  const podHidden = Boolean(detail.pod.deletedAt) || !detail.pod.isActive;
  const accessConfigured = detail.owners.length > 0;
  const ownerLabel = detail.owners[0]
    ? detail.owners[0].name?.trim() || detail.owners[0].email
    : null;

  const recentNeedsAttention = detail.recentOrders.filter((o) =>
    deriveAdminOrderIssueAttention({
      vendorOrderIssues: o.vendorOrders.flatMap((vo) => vo.issues ?? []),
    }).hasActiveIssues
  ).length;

  const attentionItems: AdminPodAttentionItem[] = [];

  if (podHidden) {
    attentionItems.push({
      id: "hidden",
      title: "Pod is hidden",
      consequence: "Customers cannot find this pod on explore or public ordering pages.",
      actionLabel: "Review visibility",
      actionHref: "#ordering-controls",
      actionKind: "anchor",
      tone: "danger",
    });
  }

  const effectivelyMenuOnly =
    !podOrderingEnabled || (detail.vendors.length > 0 && menuOnlyCount === visible && visible > 0);

  if (detail.pod.mennyuOrdersPaused && podOrderingEnabled) {
    attentionItems.push({
      id: "paused",
      title: "Pod ordering is paused",
      consequence: "Customers cannot place new orders at any vendor in this pod.",
      actionLabel: "Resume ordering",
      actionHref: "#ordering-controls",
      actionKind: "anchor",
      tone: "warning",
    });
  }

  if (!profileComplete) {
    attentionItems.push({
      id: "profile",
      title: "Pod profile is incomplete",
      consequence: `Missing ${missingProfile.slice(0, 3).join(", ")}${missingProfile.length > 3 ? "…" : ""}.`,
      actionLabel: "Edit pod profile",
      actionHref: "#advanced-settings",
      actionKind: "anchor",
      tone: "warning",
    });
  }

  if (detail.vendors.length === 0) {
    attentionItems.push({
      id: "no-vendors",
      title: "No vendors are attached",
      consequence: "Add or attach a vendor before the pod can accept orders.",
      actionLabel: "Add vendor",
      actionHref: "#vendors",
      actionKind: "anchor",
      tone: "warning",
    });
  } else if (visible === 0) {
    attentionItems.push({
      id: "no-visible",
      title: "No vendors are currently visible",
      consequence: "The pod has attached vendors, but none are shown on the public pod page.",
      actionLabel: "Review vendors",
      actionHref: "#vendors",
      actionKind: "anchor",
      tone: "warning",
    });
  } else if (
    orderable === 0 &&
    !effectivelyMenuOnly &&
    !detail.pod.mennyuOrdersPaused &&
    !podHidden
  ) {
    /** Suppressed for menu-only pods: zero orderable vendors is the intended state there. */
    attentionItems.push({
      id: "no-orderable",
      title: "No vendors are currently accepting orders",
      consequence: "The pod is visible, but every vendor is closed, paused, or blocked by setup.",
      actionLabel: "Review vendors",
      actionHref: "#vendors",
      actionKind: "anchor",
      tone: "warning",
    });
  }

  if (needsAttention > 0) {
    attentionItems.push({
      id: "vendors-attention",
      title: `${needsAttention} vendor${needsAttention === 1 ? "" : "s"} need attention`,
      consequence:
        "These vendors cannot currently accept orders because setup or routing requirements are incomplete.",
      actionLabel: "Review affected vendors",
      actionHref: "#vendors",
      actionKind: "anchor",
      tone: "warning",
    });
  }

  if (!accessConfigured) {
    attentionItems.push({
      id: "access",
      title: "Pod ownership is incomplete",
      consequence: "No pod owner is assigned, so day-to-day access may be unavailable.",
      actionLabel: "Manage access",
      actionHref: "#advanced-settings",
      actionKind: "anchor",
      tone: "danger",
    });
  }

  if (detail.qr.staleWarning) {
    attentionItems.push({
      id: "qr",
      title: "QR entry may need review",
      consequence: "Previous public slugs still redirect. Confirm QR and shared links use the current URL.",
      actionLabel: "Manage QR code",
      actionHref: `/admin/pods/${podId}/qr`,
      actionKind: "link",
      tone: "warning",
    });
  }

  if (recentNeedsAttention > 0) {
    attentionItems.push({
      id: "order-issue",
      title: "A recent order needs attention",
      consequence: "At least one recent multi-vendor order had a routing failure.",
      actionLabel: "View recent orders",
      actionHref: "#recent-orders",
      actionKind: "anchor",
      tone: "danger",
    });
  }

  if (input.hasPayoutIssues) {
    attentionItems.push({
      id: "payouts",
      title: "Pod payouts need attention",
      consequence: "Review payout settings, allocations, or failed transfers.",
      actionLabel: "Open payouts",
      actionHref: `/admin/pods/${podId}/payouts`,
      actionKind: "link",
      tone: "warning",
    });
  }

  // Deduplicate overlapping attention (no-orderable + vendors-attention)
  const dedupedAttention = attentionItems.filter((item, idx, arr) => {
    if (item.id === "vendors-attention" && arr.some((a) => a.id === "no-orderable")) {
      return false;
    }
    return true;
  });

  let overallKey: AdminPodOverallStatus = "open";
  let overallLabel = "Open";
  let overallTone: AdminDetailStatusTone = "success";

  if (podHidden) {
    overallKey = "hidden";
    overallLabel = "Hidden";
    overallTone = "danger";
  } else if (effectivelyMenuOnly) {
    /** Browsable by design — never "no orderable vendors" or "setup required". */
    overallKey = "menu_only";
    overallLabel = "Menu only";
    overallTone = "neutral";
  } else if (detail.pod.mennyuOrdersPaused) {
    overallKey = "paused";
    overallLabel = "Paused";
    overallTone = "warning";
  } else if (!profileComplete || !accessConfigured) {
    overallKey = "setup_required";
    overallLabel = "Setup required";
    overallTone = "warning";
  } else if (detail.vendors.length === 0 || orderable === 0) {
    if (visible > 0 && closedByHoursCount === visible) {
      overallKey = "closed_by_hours";
      overallLabel = "Closed by hours";
      overallTone = "neutral";
    } else {
      overallKey = "no_orderable_vendors";
      overallLabel = "No orderable vendors";
      overallTone = "warning";
    }
  } else if (recentNeedsAttention > 0) {
    // Still accepting orders, but elevate when a recent multi-vendor failure exists.
    overallKey = "operational_issue";
    overallLabel = "Operational issue";
    overallTone = "warning";
  }

  const acceptingOrders = overallKey === "open" && orderable > 0;

  let orderingLabel = "Unavailable";
  let orderingDetail: string | undefined;
  if (podHidden) {
    orderingLabel = "Hidden";
  } else if (effectivelyMenuOnly) {
    orderingLabel = "Menu only";
    orderingDetail = `${visible} vendor${visible === 1 ? "" : "s"} browsable`;
  } else if (detail.pod.mennyuOrdersPaused) {
    orderingLabel = "Paused";
  } else if (orderable > 0) {
    orderingLabel = "Open";
    orderingDetail = `${orderable} vendor${orderable === 1 ? "" : "s"} accepting orders`;
  } else if (visible > 0 && closedByHoursCount === visible) {
    orderingLabel = "Closed by hours";
    orderingDetail = "Visible vendors are outside business hours";
  } else if (!profileComplete || !accessConfigured) {
    orderingLabel = "Blocked by setup";
  } else {
    orderingLabel = "Unavailable";
    orderingDetail = "No vendors are currently orderable";
  }

  return {
    podId,
    name: detail.pod.name,
    slug: detail.pod.slug,
    publicUrl: detail.pod.publicUrl,
    publicPath: detail.pod.publicPath,
    locationLabel: detail.pod.address?.trim() || null,
    overallStatus: {
      key: overallKey,
      label: overallLabel,
      tone: overallTone,
      detail: acceptingOrders ? undefined : orderingDetail,
    },
    secondaryBadge: {
      label: effectivelyMenuOnly
        ? `${detail.vendors.length} vendor${detail.vendors.length === 1 ? "" : "s"} · menu only`
        : `${detail.vendors.length} vendor${detail.vendors.length === 1 ? "" : "s"} · ${open} open`,
    },
    visibility: {
      visible: !podHidden,
      label: detail.pod.deletedAt ? "Deleted" : detail.pod.isActive ? "Visible" : "Hidden",
    },
    ordering: {
      acceptingOrders,
      label: orderingLabel,
      detail: orderingDetail,
    },
    orderingMode: {
      podOrderingEnabled,
      effectivelyMenuOnly,
      label: podOrderingEnabled
        ? ORDERING_MODE_COPY.enabledLabel
        : ORDERING_MODE_COPY.menuOnlyLabel,
      description: podOrderingEnabled
        ? ORDERING_MODE_COPY.podEnabledDescription
        : ORDERING_MODE_COPY.podMenuOnlyDescription,
    },
    hours: {
      statusLabel:
        open > 0 ? "Vendors open now" : closedByHoursCount > 0 ? "Vendors closed now" : "Hours vary by vendor",
      nextChangeLabel: "Pod availability follows each vendor’s schedule",
    },
    profile: {
      complete: profileComplete,
      label: profileComplete ? "Complete" : "Action required",
      missingFields: missingProfile,
    },
    vendors: {
      totalAttached: detail.vendors.length,
      visible,
      orderable,
      menuOnly: menuOnlyCount,
      open,
      hidden,
      needsAttention,
    },
    orders: {
      recentNeedsAttention,
      label:
        recentNeedsAttention > 0
          ? `${recentNeedsAttention} recent order${recentNeedsAttention === 1 ? "" : "s"} need attention`
          : "No recent order issues",
    },
    access: {
      configured: accessConfigured,
      ownerLabel,
      label: accessConfigured ? "Access configured" : "Action required",
    },
    qr: { stale: Boolean(detail.qr.staleWarning) },
    vendorRows,
    attentionItems: dedupedAttention,
    links: {
      podDashboard: `/pod/${podId}/dashboard`,
      publicPage: detail.pod.publicPath,
      ordersFilter: `/admin/orders?podId=${encodeURIComponent(podId)}`,
      qrPage: `/admin/pods/${podId}/qr`,
      payoutsPage: `/admin/pods/${podId}/payouts`,
      diagnostics: `/admin/pods/${podId}/diagnostics`,
      hoursSettings: `/pod/${podId}/settings`,
    },
  };
}

import { VENDOR_ORDERING_MODE_LABELS } from "@/lib/vendor-ordering-mode";
import type { VendorPodReadinessStatus } from "@/lib/vendor-pod-readiness";

/** Durable ordering intent as the pod owner sees it for one vendor. */
export type PodOwnerVendorOrderingIntent = {
  menuOnly: boolean;
  /** Menu-only because the pod-wide switch is off, not the vendor's own setting. */
  menuOnlyByPod: boolean;
};

/** Simple owner-facing status label derived from existing readiness state. */
export function podOwnerVendorDisplayStatus(
  status: VendorPodReadinessStatus,
  canAcceptOrders: boolean,
  setupSummary?: { publicProfile?: boolean; profile?: boolean; menu?: boolean; hours?: boolean },
  orderingIntent?: PodOwnerVendorOrderingIntent
): string {
  if (canAcceptOrders) {
    return "Live";
  }

  const publicReady = setupSummary?.publicProfile ?? (
    setupSummary?.profile && setupSummary?.menu && (setupSummary?.hours ?? true)
  );
  if (publicReady === false) {
    return "Hidden";
  }

  /**
   * Menu-only outranks every setup status: the vendor is working as configured, so it must not
   * read as "Needs Stripe" or "Not orderable".
   */
  if (orderingIntent?.menuOnly) {
    return orderingIntent.menuOnlyByPod
      ? VENDOR_ORDERING_MODE_LABELS.menu_only_pod_disabled
      : VENDOR_ORDERING_MODE_LABELS.menu_only;
  }

  switch (status) {
    case "needs_payment":
      return "Needs Stripe";
    case "needs_menu":
      return "Needs menu";
    case "needs_hours":
      return "Missing customer ordering hours";
    case "needs_pos":
      return "Needs Deliverect setup";
    case "needs_profile":
      return "Needs profile";
    case "paused_in_pod":
      return "Paused in pod";
    case "paused_by_vendor":
      return "Paused by vendor";
    case "inactive_by_open_order":
    case "pod_inactive":
      return "Not orderable";
    case "ready":
    case "active":
      return "Not orderable";
    default:
      return "Not orderable";
  }
}

/** Lower sort keys appear first in the needs-attention list. */
export function vendorAdoptionAttentionSortKey(status: VendorPodReadinessStatus): number {
  switch (status) {
    case "needs_profile":
    case "needs_payment":
    case "needs_pos":
    case "needs_menu":
    case "needs_hours":
      return 0;
    case "paused_in_pod":
    case "paused_by_vendor":
      return 1;
    case "ready":
      return 2;
    case "inactive_by_open_order":
    case "pod_inactive":
      return 3;
    case "active":
      return 99;
    default:
      return 4;
  }
}

/** Menu-only vendors are configured, not unfinished, so they never need adoption chasing. */
export function vendorNeedsAdoptionAttention(
  status: VendorPodReadinessStatus,
  canAcceptOrders: boolean,
  menuOnly?: boolean
): boolean {
  if (menuOnly) return false;
  return !canAcceptOrders;
}

export type PodLaunchReadinessSummary = {
  activeVendorCount: number;
  orderableCount: number;
  /** Active vendors that are intentionally menu-only. Excluded from orderable counts. */
  menuOnlyCount: number;
  allOrderable: boolean;
  headline: string;
  detail: string;
};

export function computePodLaunchReadinessSummary(
  rows: Array<{
    podVendorActive: boolean;
    vendorGloballyActive: boolean;
    menuOnly?: boolean;
    readiness: { canAcceptOrders: boolean };
  }>
): PodLaunchReadinessSummary {
  const activeVendors = rows.filter((row) => row.podVendorActive && row.vendorGloballyActive);
  const activeVendorCount = activeVendors.length;
  const menuOnlyVendors = activeVendors.filter((row) => row.menuOnly);
  const menuOnlyCount = menuOnlyVendors.length;
  /** Only vendors with ordering intent belong in the orderable ratio. */
  const orderingVendors = activeVendors.filter((row) => !row.menuOnly);
  const orderableCount = orderingVendors.filter((row) => row.readiness.canAcceptOrders).length;
  const allOrderable = orderingVendors.length > 0 && orderableCount === orderingVendors.length;
  const allMenuOnly = activeVendorCount > 0 && menuOnlyCount === activeVendorCount;

  if (allMenuOnly) {
    return {
      activeVendorCount,
      orderableCount: 0,
      menuOnlyCount,
      allOrderable: false,
      headline: `${activeVendorCount} vendor${activeVendorCount === 1 ? "" : "s"} listed as menu only`,
      detail: "Customers can browse published menus. Ordering is off across this pod.",
    };
  }

  let detail: string;
  if (activeVendorCount === 0) {
    detail = "Add vendors to your pod to start taking customer orders.";
  } else if (allOrderable) {
    detail =
      menuOnlyCount > 0
        ? "All vendors set up for ordering are ready for customer orders."
        : "All active vendors are ready for customer orders.";
  } else {
    detail = "Some vendors still need setup before customers can order from them.";
  }

  return {
    activeVendorCount,
    orderableCount,
    menuOnlyCount,
    allOrderable,
    headline:
      menuOnlyCount > 0
        ? `${orderableCount} of ${orderingVendors.length} ordering vendors are orderable`
        : `${orderableCount} of ${activeVendorCount} active vendors are orderable`,
    detail,
  };
}

function blockerReminderLine(blockerCode: string | null | undefined): string | null {
  switch (blockerCode) {
    case "stripe":
    case "needs_payment":
      return "Looks like your Stripe setup still needs to be completed.";
    case "menu":
    case "needs_menu":
      return "Looks like your menu is not ready yet.";
    case "hours":
    case "needs_hours":
      return "Looks like your customer ordering hours still need to be set.";
    case "pos":
    case "needs_pos":
      return "Looks like your POS connection still needs setup.";
    case "profile":
    case "needs_profile":
      return "Looks like your vendor profile still needs to be completed.";
    default:
      return null;
  }
}

/** Copyable reminder text for pod owners to send vendors (clipboard only). */
export function buildVendorAdoptionReminderMessage(
  vendorName: string,
  status: VendorPodReadinessStatus,
  blockerCode?: string | null
): string {
  const name = vendorName.trim() || "there";
  const lines = [
    `Hi ${name} — we're getting our Open Order pod page ready. Your vendor setup still needs attention before customers can order from you through our pod page. Please finish your Open Order setup when you can.`,
  ];

  const blockerLine =
    blockerReminderLine(blockerCode) ??
    (status === "paused_by_vendor"
      ? "Looks like new orders are paused on your Open Order account."
      : status === "paused_in_pod"
        ? "Your menu is currently paused in our pod — let us know when you're ready to go live here."
        : null);

  if (blockerLine) {
    lines.push(blockerLine);
  }

  return lines.join("\n\n");
}

/**
 * Vendor-facing setup path safe for pod owners to share. Returns null when no helpful link exists.
 */
export function buildVendorSetupSettingsPath(
  vendorId: string,
  status: VendorPodReadinessStatus,
  blockerCode?: string | null
): string | null {
  if (status === "paused_in_pod" || status === "inactive_by_open_order" || status === "pod_inactive") {
    return null;
  }

  const settingsBase = `/vendor/${vendorId}/settings`;
  const code = blockerCode ?? status;

  switch (code) {
    case "profile":
    case "needs_profile":
      return settingsBase;
    case "stripe":
    case "needs_payment":
      return `/vendor/${vendorId}/payouts`;
    case "pos":
    case "needs_pos":
      return `/vendor/${vendorId}/connect-pos`;
    case "menu":
    case "needs_menu":
      return `/vendor/${vendorId}/menu`;
    case "hours":
    case "needs_hours":
      return `/vendor/${vendorId}/hours`;
    case "paused_by_vendor":
      return settingsBase;
    default:
      return settingsBase;
  }
}

export type PodAdoptionAttentionRow = {
  vendorId: string;
  vendorSlug: string;
  name: string;
  imageUrl: string | null;
  displayStatus: string;
  status: VendorPodReadinessStatus;
  primaryBlockerCode: string | null;
  setupPath: string | null;
  reminderText: string;
};

export function buildPodAdoptionAttentionRows(
  rows: Array<{
    vendorId: string;
    vendorSlug: string;
    name: string;
    imageUrl: string | null;
    menuOnly?: boolean;
    readiness: {
      status: VendorPodReadinessStatus;
      canAcceptOrders: boolean;
      primaryBlocker: { code: string } | null;
    };
  }>
): PodAdoptionAttentionRow[] {
  return rows
    .filter((row) =>
      vendorNeedsAdoptionAttention(row.readiness.status, row.readiness.canAcceptOrders, row.menuOnly)
    )
    .map((row) => {
      const blockerCode = row.readiness.primaryBlocker?.code ?? null;
      return {
        vendorId: row.vendorId,
        vendorSlug: row.vendorSlug,
        name: row.name,
        imageUrl: row.imageUrl,
        displayStatus: podOwnerVendorDisplayStatus(row.readiness.status, row.readiness.canAcceptOrders),
        status: row.readiness.status,
        primaryBlockerCode: blockerCode,
        setupPath: buildVendorSetupSettingsPath(row.vendorId, row.readiness.status, blockerCode),
        reminderText: buildVendorAdoptionReminderMessage(row.name, row.readiness.status, blockerCode),
      };
    })
    .sort((a, b) => {
      const keyDiff = vendorAdoptionAttentionSortKey(a.status) - vendorAdoptionAttentionSortKey(b.status);
      if (keyDiff !== 0) return keyDiff;
      return a.name.localeCompare(b.name);
    });
}

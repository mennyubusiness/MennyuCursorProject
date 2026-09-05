import "server-only";

import { VendorMembershipRole, type VendorOrderRoutingMode } from "@prisma/client";
import { buildPodCustomerPath, buildVendorMenuCustomerPath } from "@/lib/customer-public-url";
import { prisma } from "@/lib/db";
import { listSlugRedirectsForEntity } from "@/lib/slug-admin.server";
import { listAdminAuditLogsForVendor } from "@/services/admin-audit-log.service";
import { loadVendorMenuSyncSummary } from "@/services/admin-vendor-rescue.service";
import { getVendorOrderabilityInPod } from "@/lib/vendor-orderability-in-pod";
import { getVendorClaimState, type VendorClaimState } from "@/lib/vendor-claim-state";

export type AdminVendorDetailView = {
  vendor: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    contactEmail: string | null;
    imageUrl: string | null;
    isActive: boolean;
    mennyuOrdersPaused: boolean;
    /** Durable menu-only intent for this vendor. */
    orderingEnabled: boolean;
    deletedAt: string | null;
    deletedByUserId: string | null;
    deletedByEmail: string | null;
    posConnectionStatus: string;
    posProvider: string | null;
    deliverectChannelLinkId: string | null;
    deliverectLocationId: string | null;
    orderRoutingMode: string;
    squareOrderRoutingEnabled: boolean;
    menuSource: string;
    vendorDashboardLastSeenAt: string | null;
    stripeConnectedAccountId: string | null;
    stripeDetailsSubmitted: boolean;
    stripeChargesEnabled: boolean;
    stripePayoutsEnabled: boolean;
    onboardingStatus: string;
    createdAt: string;
    updatedAt: string;
    publicPathPreview: string;
  };
  pods: Array<{
    podId: string;
    podName: string;
    podSlug: string;
    podVendorActive: boolean;
    /** Pod-wide ordering intent. When false, this vendor is effectively menu-only. */
    podOrderingEnabled: boolean;
    publicPath: string;
  }>;
  owners: Array<{ userId: string; email: string; name: string | null; role: string }>;
  claimState: VendorClaimState;
  claimInvite: {
    invitedEmail: string;
    expiresAt: string;
    claimedAt: string | null;
    revokedAt: string | null;
  } | null;
  menuSync: Awaited<ReturnType<typeof loadVendorMenuSyncSummary>>;
  readinessSummary: { label: string; canAcceptOrders: boolean };
  recentOrders: Array<{
    id: string;
    routingStatus: string;
    fulfillmentStatus: string;
    createdAt: string;
    totalCents: number;
  }>;
  slugRedirects: Array<{ id: string; oldSlug: string; newSlug: string; createdAt: string }>;
  auditLogs: Array<{
    id: string;
    actionType: string;
    reason: string | null;
    oldValue: string | null;
    newValue: string | null;
    createdAt: string;
    adminEmail: string | null;
  }>;
};

export async function loadAdminVendorDetail(vendorId: string): Promise<AdminVendorDetailView | null> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    include: {
      pods: {
        include: {
          pod: {
            select: {
              id: true,
              name: true,
              slug: true,
              isActive: true,
              mennyuOrdersPaused: true,
              orderingEnabled: true,
            },
          },
        },
      },
      vendorMemberships: {
        include: { user: { select: { id: true, email: true, name: true } } },
        orderBy: { role: "asc" },
      },
      claimInvite: true,
    },
  });
  if (!vendor) return null;

  const deletedByUser = vendor.deletedByUserId
    ? await prisma.user.findUnique({
        where: { id: vendor.deletedByUserId },
        select: { email: true },
      })
    : null;

  const primaryPod = vendor.pods[0]?.pod ?? null;

  const [menuSync, recentOrders, auditRows, slugRedirects] = await Promise.all([
    loadVendorMenuSyncSummary(vendorId),
    prisma.vendorOrder.findMany({
      where: { vendorId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        routingStatus: true,
        fulfillmentStatus: true,
        createdAt: true,
        totalCents: true,
      },
    }),
    listAdminAuditLogsForVendor(vendorId, 30),
    listSlugRedirectsForEntity("vendor", vendorId),
  ]);

  let readinessSummary = { label: "No pod membership", canAcceptOrders: false };
  if (primaryPod && vendor.pods[0]) {
    const orderability = getVendorOrderabilityInPod({
      podActive: primaryPod.isActive,
      podOrdersPaused: primaryPod.mennyuOrdersPaused ?? false,
      podOrderingEnabled: primaryPod.orderingEnabled,
      vendorOrderingEnabled: vendor.orderingEnabled,
      podVendorExists: true,
      podVendorActive: vendor.pods[0].isActive,
      vendor: {
        isActive: vendor.isActive,
        mennyuOrdersPaused: vendor.mennyuOrdersPaused,
      },
    });
    readinessSummary = {
      label: orderability.orderable ? "Orderable" : orderability.message ?? "Not orderable",
      canAcceptOrders: orderability.orderable,
    };
  }

  return {
    vendor: {
      id: vendor.id,
      name: vendor.name,
      slug: vendor.slug,
      description: vendor.description,
      contactEmail: vendor.contactEmail,
      imageUrl: vendor.imageUrl,
      isActive: vendor.isActive,
      mennyuOrdersPaused: vendor.mennyuOrdersPaused,
      orderingEnabled: vendor.orderingEnabled,
      deletedAt: vendor.deletedAt?.toISOString() ?? null,
      deletedByUserId: vendor.deletedByUserId,
      deletedByEmail: deletedByUser?.email ?? null,
      posConnectionStatus: vendor.posConnectionStatus,
      posProvider: vendor.posProvider,
      deliverectChannelLinkId: vendor.deliverectChannelLinkId,
      deliverectLocationId: vendor.deliverectLocationId,
      orderRoutingMode: vendor.orderRoutingMode,
      squareOrderRoutingEnabled: vendor.squareOrderRoutingEnabled,
      menuSource: vendor.menuSource,
      vendorDashboardLastSeenAt: vendor.vendorDashboardLastSeenAt?.toISOString() ?? null,
      stripeConnectedAccountId: vendor.stripeConnectedAccountId,
      stripeDetailsSubmitted: vendor.stripeDetailsSubmitted,
      stripeChargesEnabled: vendor.stripeChargesEnabled,
      stripePayoutsEnabled: vendor.stripePayoutsEnabled,
      onboardingStatus: vendor.onboardingStatus,
      createdAt: vendor.createdAt.toISOString(),
      updatedAt: vendor.updatedAt.toISOString(),
      publicPathPreview: primaryPod
        ? buildVendorMenuCustomerPath(primaryPod.slug, vendor.slug)
        : `/{podSlug}/${vendor.slug}`,
    },
    pods: vendor.pods.map((pv) => ({
      podId: pv.pod.id,
      podName: pv.pod.name,
      podSlug: pv.pod.slug,
      podVendorActive: pv.isActive,
      podOrderingEnabled: pv.pod.orderingEnabled,
      publicPath: buildVendorMenuCustomerPath(pv.pod.slug, vendor.slug),
    })),
    owners: vendor.vendorMemberships.map((m) => ({
      userId: m.user.id,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
    })),
    claimState: getVendorClaimState({
      memberships: vendor.vendorMemberships,
      claimInvite: vendor.claimInvite,
    }),
    claimInvite: vendor.claimInvite
      ? {
          invitedEmail: vendor.claimInvite.invitedEmail,
          expiresAt: vendor.claimInvite.expiresAt.toISOString(),
          claimedAt: vendor.claimInvite.claimedAt?.toISOString() ?? null,
          revokedAt: vendor.claimInvite.revokedAt?.toISOString() ?? null,
        }
      : null,
    menuSync,
    readinessSummary,
    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      routingStatus: o.routingStatus,
      fulfillmentStatus: o.fulfillmentStatus,
      createdAt: o.createdAt.toISOString(),
      totalCents: o.totalCents,
    })),
    slugRedirects: slugRedirects.map((r) => ({
      id: r.id,
      oldSlug: r.oldSlug,
      newSlug: r.newSlug,
      createdAt: r.createdAt.toISOString(),
    })),
    auditLogs: auditRows.map((row) => ({
      id: row.id,
      actionType: row.actionType,
      reason: row.reason,
      oldValue: row.oldValue,
      newValue: row.newValue,
      createdAt: row.createdAt.toISOString(),
      adminEmail: row.adminUser?.email ?? null,
    })),
  };
}

export type AdminVendorSearchRow = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  mennyuOrdersPaused: boolean;
  /** Durable menu-only intent for this vendor. */
  orderingEnabled: boolean;
  posConnectionStatus: string;
  orderRoutingMode: string;
  vendorDashboardLastSeenAt: string | null;
  podNames: string[];
  ownerEmails: string[];
  publicPathPreview: string;
  stripeSummary: string;
  menuSyncLabel: string;
};

export type AdminVendorSearchOptions = {
  /** Authoritative Vendor.orderRoutingMode filter. Omit / null = all routing methods. */
  orderRoutingMode?: VendorOrderRoutingMode | null;
  /**
   * Durable ordering intent filter, deliberately separate from `orderRoutingMode`:
   * routing describes *how* orders travel, ordering mode describes *whether* they are taken.
   */
  orderingMode?: AdminVendorOrderingModeFilter | null;
  ownership?: AdminVendorOwnershipFilter | null;
  limit?: number;
};

export type AdminVendorOrderingModeFilter = "orderable" | "menu_only";
export type AdminVendorOwnershipFilter = "claimed" | "unclaimed";

export function parseAdminVendorOrderingModeQuery(
  raw: string | null | undefined
): AdminVendorOrderingModeFilter | null {
  const value = raw?.trim();
  if (value === "orderable" || value === "menu_only") return value;
  return null;
}

export function parseAdminVendorOwnershipQuery(
  raw: string | null | undefined
): AdminVendorOwnershipFilter | null {
  const value = raw?.trim();
  return value === "claimed" || value === "unclaimed" ? value : null;
}

/**
 * Admin vendor search. Filters by text query and/or authoritative orderRoutingMode.
 * Historical POS/menu data alone does not affect the routing filter.
 */
export async function searchAdminVendors(
  rawQuery: string,
  options: AdminVendorSearchOptions | number = {}
): Promise<AdminVendorSearchRow[]> {
  const opts: AdminVendorSearchOptions =
    typeof options === "number" ? { limit: options } : options;
  const q = rawQuery.trim();
  const routing = opts.orderRoutingMode ?? null;
  const orderingMode = opts.orderingMode ?? null;
  const ownership = opts.ownership ?? null;
  const limit = opts.limit ?? (q ? 50 : 200);

  if (!q && !routing && !orderingMode && !ownership) return [];

  const where: {
    OR?: object[];
    orderRoutingMode?: VendorOrderRoutingMode;
    orderingEnabled?: boolean;
    vendorMemberships?: object;
  } = {};

  if (q) {
    const orConditions: object[] = [
      { name: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
      { deliverectChannelLinkId: { contains: q, mode: "insensitive" } },
      { deliverectLocationId: { contains: q, mode: "insensitive" } },
      { stripeConnectedAccountId: { contains: q, mode: "insensitive" } },
      { pods: { some: { pod: { name: { contains: q, mode: "insensitive" } } } } },
      { vendorMemberships: { some: { user: { email: { contains: q, mode: "insensitive" } } } } },
    ];
    if (q.length >= 20) orConditions.push({ id: q });
    where.OR = orConditions;
  }

  if (routing) {
    where.orderRoutingMode = routing;
  }

  if (orderingMode) {
    where.orderingEnabled = orderingMode === "orderable";
  }
  if (ownership) {
    where.vendorMemberships =
      ownership === "claimed"
        ? { some: { role: VendorMembershipRole.owner } }
        : { none: { role: VendorMembershipRole.owner } };
  }

  const vendors = await prisma.vendor.findMany({
    where,
    include: {
      pods: { include: { pod: { select: { name: true, slug: true } } }, take: 3 },
      vendorMemberships: {
        where: { role: VendorMembershipRole.owner },
        include: { user: { select: { email: true } } },
        take: 2,
      },
    },
    orderBy: { name: "asc" },
    take: limit,
  });

  return vendors.map((v) => ({
    id: v.id,
    name: v.name,
    slug: v.slug,
    isActive: v.isActive,
    mennyuOrdersPaused: v.mennyuOrdersPaused,
    orderingEnabled: v.orderingEnabled,
    posConnectionStatus: v.posConnectionStatus,
    orderRoutingMode: v.orderRoutingMode,
    vendorDashboardLastSeenAt: v.vendorDashboardLastSeenAt?.toISOString() ?? null,
    podNames: v.pods.map((p) => p.pod.name),
    ownerEmails: v.vendorMemberships.map((m) => m.user.email),
    publicPathPreview: v.pods[0]
      ? buildVendorMenuCustomerPath(v.pods[0].pod.slug, v.slug)
      : buildPodCustomerPath(v.slug),
    stripeSummary: v.stripeConnectedAccountId
      ? v.stripeChargesEnabled
        ? "Charges enabled"
        : "Connect incomplete"
      : "Not connected",
    menuSyncLabel: v.deliverectChannelLinkId ? "POS linked" : "No POS link",
  }));
}

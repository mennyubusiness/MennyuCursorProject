import "server-only";

import { VendorMembershipRole } from "@prisma/client";
import { buildPodCustomerPath, buildVendorMenuCustomerPath } from "@/lib/customer-public-url";
import { prisma } from "@/lib/db";
import { listSlugRedirectsForEntity } from "@/lib/slug-admin.server";
import { listAdminAuditLogsForVendor } from "@/services/admin-audit-log.service";
import { loadVendorMenuSyncSummary } from "@/services/admin-vendor-rescue.service";
import { getVendorOrderabilityInPod } from "@/lib/vendor-orderability-in-pod";

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
    posConnectionStatus: string;
    posProvider: string | null;
    deliverectChannelLinkId: string | null;
    deliverectLocationId: string | null;
    orderRoutingMode: string;
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
    publicPath: string;
  }>;
  owners: Array<{ userId: string; email: string; name: string | null; role: string }>;
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
      pods: { include: { pod: { select: { id: true, name: true, slug: true, isActive: true, mennyuOrdersPaused: true } } } },
      vendorMemberships: {
        include: { user: { select: { id: true, email: true, name: true } } },
        orderBy: { role: "asc" },
      },
    },
  });
  if (!vendor) return null;

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
      posConnectionStatus: vendor.posConnectionStatus,
      posProvider: vendor.posProvider,
      deliverectChannelLinkId: vendor.deliverectChannelLinkId,
      deliverectLocationId: vendor.deliverectLocationId,
      orderRoutingMode: vendor.orderRoutingMode,
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
      publicPath: buildVendorMenuCustomerPath(pv.pod.slug, vendor.slug),
    })),
    owners: vendor.vendorMemberships.map((m) => ({
      userId: m.user.id,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
    })),
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
  posConnectionStatus: string;
  podNames: string[];
  ownerEmails: string[];
  publicPathPreview: string;
  stripeSummary: string;
  menuSyncLabel: string;
};

export async function searchAdminVendors(rawQuery: string, limit = 50): Promise<AdminVendorSearchRow[]> {
  const q = rawQuery.trim();
  if (!q) return [];

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

  const vendors = await prisma.vendor.findMany({
    where: { OR: orConditions },
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
    posConnectionStatus: v.posConnectionStatus,
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

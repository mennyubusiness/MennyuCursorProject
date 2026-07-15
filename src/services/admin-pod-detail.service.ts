import "server-only";

import { PodMembershipRole } from "@prisma/client";
import { buildPodCustomerPath } from "@/lib/customer-public-url";
import { prisma } from "@/lib/db";
import { buildPodOrderingAbsoluteUrl } from "@/lib/pod-ordering-url";
import { getPublicSiteOriginFromEnv } from "@/lib/public-site-url";
import { listSlugRedirectsForEntity } from "@/lib/slug-admin.server";
import { adminPodReadinessLabel } from "@/lib/admin-pod-detail-layout";
import { listAdminAuditLogsForPod } from "@/services/admin-audit-log.service";

export type AdminPodDetailView = {
  pod: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    address: string | null;
    contactEmail: string | null;
    imageUrl: string | null;
    pickupTimezone: string | null;
    isActive: boolean;
    mennyuOrdersPaused: boolean;
    deletedAt: string | null;
    deletedByUserId: string | null;
    deletedByEmail: string | null;
    onboardingStatus: string;
    createdAt: string;
    updatedAt: string;
    publicPath: string;
    publicUrl: string;
  };
  qr: {
    destinationUrl: string;
    matchesCanonical: boolean;
    staleWarning: string | null;
    note: string;
  };
  owners: Array<{ userId: string; email: string; name: string | null; role: string }>;
  vendors: Array<{
    vendorId: string;
    vendorName: string;
    vendorSlug: string;
    cuisineCategory: string | null;
    description: string | null;
    imageUrl: string | null;
    deletedAt: string | null;
    podVendorActive: boolean;
    vendorActive: boolean;
    mennyuOrdersPaused: boolean;
    orderRoutingMode: string;
    customerOrderingHours: unknown;
  }>;
  invites: {
    pending: number;
    accepted: number;
    revoked: number;
    expired: number;
    recent: Array<{ id: string; email: string; status: string; createdAt: string }>;
  };
  recentOrders: Array<{
    id: string;
    status: string;
    createdAt: string;
    totalCents: number;
    vendorOrders: Array<{ routingStatus: string; fulfillmentStatus: string }>;
  }>;
  slugRedirects: Array<{ id: string; oldSlug: string; newSlug: string; createdAt: string }>;
  readinessLabel: string;
  activeVendorCount: number;
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

export async function loadAdminPodDetail(podId: string): Promise<AdminPodDetailView | null> {
  const pod = await prisma.pod.findUnique({
    where: { id: podId },
    include: {
      vendors: {
        include: {
          vendor: {
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
              imageUrl: true,
              cuisineCategory: true,
              isActive: true,
              mennyuOrdersPaused: true,
              deletedAt: true,
              orderRoutingMode: true,
              customerOrderingHours: true,
            },
          },
        },
        orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }],
      },
      memberships: {
        where: { role: PodMembershipRole.owner },
        include: { user: { select: { id: true, email: true, name: true } } },
      },
    },
  });
  if (!pod) return null;

  const deletedByUser = pod.deletedByUserId
    ? await prisma.user.findUnique({
        where: { id: pod.deletedByUserId },
        select: { email: true },
      })
    : null;

  const origin = getPublicSiteOriginFromEnv();
  const publicPath = buildPodCustomerPath(pod.slug);
  const publicUrl = origin ? `${origin.replace(/\/$/, "")}${publicPath}` : publicPath;
  const qrDestination = origin ? buildPodOrderingAbsoluteUrl(origin, pod.slug) : publicUrl;

  const staleRedirects = await listSlugRedirectsForEntity("pod", podId);
  const staleWarning =
    staleRedirects.length > 0 && staleRedirects.some((r) => r.newSlug !== pod.slug)
      ? "Previous slug redirects exist — verify QR and shared links use the current slug."
      : null;

  const [recentOrders, inviteRows, auditRows] = await Promise.all([
    prisma.order.findMany({
      where: { podId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        status: true,
        createdAt: true,
        totalCents: true,
        vendorOrders: {
          select: { routingStatus: true, fulfillmentStatus: true },
        },
      },
    }),
    prisma.podVendorInvite.findMany({
      where: { podId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, invitedEmail: true, status: true, createdAt: true },
    }),
    listAdminAuditLogsForPod(podId, 30),
  ]);

  const inviteCounts = { pending: 0, accepted: 0, revoked: 0, expired: 0 };
  for (const invite of inviteRows) {
    if (invite.status in inviteCounts) {
      inviteCounts[invite.status as keyof typeof inviteCounts] += 1;
    }
  }

  return {
    pod: {
      id: pod.id,
      name: pod.name,
      slug: pod.slug,
      description: pod.description,
      address: pod.address,
      contactEmail: pod.contactEmail,
      imageUrl: pod.imageUrl,
      pickupTimezone: pod.pickupTimezone,
      isActive: pod.isActive,
      mennyuOrdersPaused: pod.mennyuOrdersPaused,
      deletedAt: pod.deletedAt?.toISOString() ?? null,
      deletedByUserId: pod.deletedByUserId,
      deletedByEmail: deletedByUser?.email ?? null,
      onboardingStatus: pod.onboardingStatus,
      createdAt: pod.createdAt.toISOString(),
      updatedAt: pod.updatedAt.toISOString(),
      publicPath,
      publicUrl,
    },
    qr: {
      destinationUrl: qrDestination,
      matchesCanonical: qrDestination.includes(publicPath) || qrDestination.endsWith(publicPath),
      staleWarning,
      note: "QR codes are generated dynamically from the canonical pod URL. No stored QR history.",
    },
    owners: pod.memberships.map((m) => ({
      userId: m.user.id,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
    })),
    vendors: pod.vendors.map((pv) => ({
      vendorId: pv.vendor.id,
      vendorName: pv.vendor.name,
      vendorSlug: pv.vendor.slug,
      cuisineCategory: pv.vendor.cuisineCategory,
      description: pv.vendor.description,
      imageUrl: pv.vendor.imageUrl,
      deletedAt: pv.vendor.deletedAt?.toISOString() ?? null,
      podVendorActive: pv.isActive,
      vendorActive: pv.vendor.isActive,
      mennyuOrdersPaused: pv.vendor.mennyuOrdersPaused,
      orderRoutingMode: pv.vendor.orderRoutingMode,
      customerOrderingHours: pv.vendor.customerOrderingHours,
    })),
    invites: {
      ...inviteCounts,
      recent: inviteRows.slice(0, 8).map((i) => ({
        id: i.id,
        email: i.invitedEmail,
        status: i.status,
        createdAt: i.createdAt.toISOString(),
      })),
    },
    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
      totalCents: o.totalCents,
      vendorOrders: o.vendorOrders.map((vo) => ({
        routingStatus: vo.routingStatus,
        fulfillmentStatus: vo.fulfillmentStatus,
      })),
    })),
    slugRedirects: staleRedirects.map((r) => ({
      id: r.id,
      oldSlug: r.oldSlug,
      newSlug: r.newSlug,
      createdAt: r.createdAt.toISOString(),
    })),
    readinessLabel: adminPodReadinessLabel(pod.onboardingStatus, pod.isActive),
    activeVendorCount: pod.vendors.filter(
      (pv) => pv.isActive && pv.vendor.isActive && !pv.vendor.deletedAt
    ).length,
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

export type AdminPodSearchRow = {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  isActive: boolean;
  mennyuOrdersPaused: boolean;
  vendorCount: number;
  orderableVendorCount: number;
  ownerEmails: string[];
  publicPath: string;
  readinessLabel: string;
};

export async function searchAdminPods(rawQuery: string, limit = 50): Promise<AdminPodSearchRow[]> {
  const q = rawQuery.trim();
  if (!q) return [];

  const orConditions: object[] = [
    { name: { contains: q, mode: "insensitive" } },
    { slug: { contains: q, mode: "insensitive" } },
    { address: { contains: q, mode: "insensitive" } },
    { vendors: { some: { vendor: { name: { contains: q, mode: "insensitive" } } } } },
    {
      memberships: {
        some: {
          role: PodMembershipRole.owner,
          user: { email: { contains: q, mode: "insensitive" } },
        },
      },
    },
  ];
  if (q.length >= 20) orConditions.push({ id: q });

  const pods = await prisma.pod.findMany({
    where: { OR: orConditions },
    include: {
      vendors: {
        include: {
          vendor: { select: { isActive: true, mennyuOrdersPaused: true, deletedAt: true } },
        },
      },
      memberships: {
        where: { role: PodMembershipRole.owner },
        include: { user: { select: { email: true } } },
        take: 2,
      },
    },
    orderBy: { name: "asc" },
    take: limit,
  });

  const { getVendorOrderabilityInPod } = await import("@/lib/vendor-orderability-in-pod");

  return pods.map((pod) => {
    let orderableVendorCount = 0;
    for (const pv of pod.vendors) {
      if (pv.vendor.deletedAt || !pv.vendor.isActive || !pv.isActive) continue;
      const orderability = getVendorOrderabilityInPod({
        podActive: pod.isActive,
        podOrdersPaused: pod.mennyuOrdersPaused,
        podVendorExists: true,
        podVendorActive: pv.isActive,
        vendor: {
          isActive: pv.vendor.isActive,
          mennyuOrdersPaused: pv.vendor.mennyuOrdersPaused,
        },
      });
      if (orderability.orderable) orderableVendorCount += 1;
    }

    return {
      id: pod.id,
      name: pod.name,
      slug: pod.slug,
      address: pod.address,
      isActive: pod.isActive,
      mennyuOrdersPaused: pod.mennyuOrdersPaused,
      vendorCount: pod.vendors.length,
      orderableVendorCount,
      ownerEmails: pod.memberships.map((m) => m.user.email),
      publicPath: buildPodCustomerPath(pod.slug),
      readinessLabel: adminPodReadinessLabel(pod.onboardingStatus, pod.isActive),
    };
  });
}

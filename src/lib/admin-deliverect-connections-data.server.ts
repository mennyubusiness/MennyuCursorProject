import "server-only";

import { prisma } from "@/lib/db";
import { parseChannelRegistrationPayload } from "@/services/deliverect-channel-registration.service";
import { findVendorByChannelLinkId } from "@/services/admin-deliverect-connection.service";
import { loadVendorMenuReadinessSummaries } from "@/lib/vendor-menu-readiness.server";
import type {
  AdminChannelRegistrationRow,
  AdminVendorDeliverectRow,
} from "@/lib/admin-deliverect-connections-types";

export type { AdminChannelRegistrationRow, AdminVendorDeliverectRow };

export async function loadAdminDeliverectConnectionsPageData(): Promise<{
  vendors: AdminVendorDeliverectRow[];
  registrations: AdminChannelRegistrationRow[];
}> {
  const [vendorsRaw, events] = await Promise.all([
    prisma.vendor.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        posConnectionStatus: true,
        pendingDeliverectConnectionKey: true,
        deliverectChannelLinkId: true,
        deliverectLocationId: true,
        deliverectAccountId: true,
        deliverectAccountEmail: true,
        deliverectAutoMapLastAt: true,
        deliverectAutoMapLastOutcome: true,
        deliverectAutoMapLastDetail: true,
        pods: {
          take: 1,
          select: { pod: { select: { name: true } } },
        },
      },
    }),
    prisma.webhookEvent.findMany({
      where: { provider: "deliverect_channel_registration" },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        createdAt: true,
        eventId: true,
        idempotencyKey: true,
        processed: true,
        errorMessage: true,
        payload: true,
      },
    }),
  ]);

  const vendorIds = vendorsRaw.map((v) => v.id);
  const menuSummaries = await loadVendorMenuReadinessSummaries(vendorIds);
  const vendorNameById = new Map(vendorsRaw.map((v) => [v.id, v.name]));

  const vendors: AdminVendorDeliverectRow[] = vendorsRaw.map((v) => {
    const menu = menuSummaries.get(v.id);
    return {
      vendorId: v.id,
      name: v.name,
      slug: v.slug,
      posConnectionStatus: v.posConnectionStatus,
      pendingDeliverectConnectionKey: v.pendingDeliverectConnectionKey,
      deliverectChannelLinkId: v.deliverectChannelLinkId,
      deliverectLocationId: v.deliverectLocationId,
      deliverectAccountId: v.deliverectAccountId,
      deliverectAccountEmail: v.deliverectAccountEmail,
      deliverectAutoMapLastAt: v.deliverectAutoMapLastAt?.toISOString() ?? null,
      deliverectAutoMapLastOutcome: v.deliverectAutoMapLastOutcome,
      deliverectAutoMapLastDetail: v.deliverectAutoMapLastDetail,
      podName: v.pods[0]?.pod.name ?? null,
      menuSummary: {
        hasPublishedMenuVersion: menu?.hasPublishedMenuVersion ?? false,
        hasAvailableOperationalItems: menu?.hasAvailableOperationalItems ?? false,
      },
    };
  });

  const registrations: AdminChannelRegistrationRow[] = [];
  for (const e of events) {
    const payload =
      e.payload && typeof e.payload === "object" && !Array.isArray(e.payload)
        ? (e.payload as Record<string, unknown>)
        : null;
    const extract = payload ? parseChannelRegistrationPayload(payload) : null;
    const channelLinkId = extract?.channelLinkId ?? null;
    const channelLocationId = extract?.channelLocationId ?? null;
    const locationId = extract?.deliverectPortalLocationId ?? null;

    const mapped = channelLinkId ? await findVendorByChannelLinkId(prisma, channelLinkId) : null;
    const likelyVendorId = channelLocationId?.trim() || null;
    const likelyVendor =
      likelyVendorId && vendorNameById.has(likelyVendorId)
        ? { vendorId: likelyVendorId, vendorName: vendorNameById.get(likelyVendorId)! }
        : null;

    registrations.push({
      id: e.id,
      createdAtIso: e.createdAt.toISOString(),
      eventId: e.eventId,
      idempotencyKey: e.idempotencyKey,
      processed: e.processed,
      errorMessage: e.errorMessage,
      channelLinkId,
      channelLocationId,
      locationId,
      status: extract?.status ?? null,
      channelLinkName: extract?.channelLinkName ?? null,
      payloadKeys: payload ? Object.keys(payload).sort() : [],
      mappedVendor: mapped
        ? { vendorId: mapped.vendorId, vendorName: mapped.vendorName }
        : null,
      likelyVendor,
    });
  }

  return { vendors, registrations };
}

/**
 * Admin Deliverect connection management — reconnect, disconnect, conflict detection.
 * Mutates only Vendor Deliverect/POS fields; never WebhookEvent, menus, or orders.
 */
import { PosConnectionStatus, type Prisma, type PrismaClient } from "@prisma/client";
import {
  applyChannelRegistrationToVendor,
  parseChannelRegistrationPayload,
  type ChannelRegistrationExtract,
} from "@/services/deliverect-channel-registration.service";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type DeliverectConnectionOwner = {
  vendorId: string;
  vendorName: string;
  deliverectChannelLinkId: string | null;
  deliverectLocationId: string | null;
  posConnectionStatus: PosConnectionStatus;
};

export type DeliverectConnectionConflictResult =
  | { ok: true; conflicts: DeliverectConnectionOwner[] }
  | { ok: false; error: string };

/** Strip accidental `ch:` prefix — stored ids must match Deliverect payload raw values. */
export function normalizeDeliverectChannelLinkId(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.toLowerCase().startsWith("ch:")) {
    return trimmed.slice(3).trim();
  }
  return trimmed;
}

export function normalizeDeliverectLocationId(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  return trimmed !== "" ? trimmed : null;
}

const DISCONNECT_DATA: Prisma.VendorUpdateInput = {
  deliverectChannelLinkId: null,
  deliverectLocationId: null,
  deliverectAccountId: null,
  deliverectAccountEmail: null,
  pendingDeliverectConnectionKey: null,
  deliverectAutoMapLastAt: null,
  deliverectAutoMapLastOutcome: null,
  deliverectAutoMapLastDetail: null,
  posProvider: null,
  posConnectionStatus: PosConnectionStatus.not_connected,
  autoPublishMenus: false,
};

export async function findDeliverectConnectionOwners(
  db: DbClient,
  input: {
    channelLinkId?: string | null;
    locationId?: string | null;
    excludeVendorId?: string;
  }
): Promise<DeliverectConnectionOwner[]> {
  const channelLinkId = input.channelLinkId?.trim() || null;
  const locationId = normalizeDeliverectLocationId(input.locationId);
  if (!channelLinkId && !locationId) return [];

  const or: Prisma.VendorWhereInput[] = [];
  if (channelLinkId) or.push({ deliverectChannelLinkId: channelLinkId });
  if (locationId) or.push({ deliverectLocationId: locationId });

  const rows = await db.vendor.findMany({
    where: {
      ...(input.excludeVendorId ? { id: { not: input.excludeVendorId } } : {}),
      OR: or,
    },
    select: {
      id: true,
      name: true,
      deliverectChannelLinkId: true,
      deliverectLocationId: true,
      posConnectionStatus: true,
    },
  });

  const byId = new Map<string, DeliverectConnectionOwner>();
  for (const row of rows) {
    byId.set(row.id, {
      vendorId: row.id,
      vendorName: row.name,
      deliverectChannelLinkId: row.deliverectChannelLinkId,
      deliverectLocationId: row.deliverectLocationId,
      posConnectionStatus: row.posConnectionStatus,
    });
  }
  return [...byId.values()];
}

export async function disconnectVendorFromDeliverect(
  db: DbClient,
  vendorId: string
): Promise<{ vendorId: string; vendorName: string }> {
  const vendor = await db.vendor.findUnique({
    where: { id: vendorId },
    select: { id: true, name: true },
  });
  if (!vendor) {
    throw new Error("Vendor not found.");
  }

  await db.vendor.update({
    where: { id: vendorId },
    data: DISCONNECT_DATA,
  });

  return { vendorId: vendor.id, vendorName: vendor.name };
}

export type ConnectVendorDeliverectInput = {
  vendorId: string;
  channelLinkId: string;
  locationId?: string | null;
  accountId?: string | null;
  accountEmail?: string | null;
  outcome?: string;
  detail?: string | null;
};

export async function connectVendorToDeliverect(
  db: DbClient,
  input: ConnectVendorDeliverectInput
): Promise<{ vendorId: string; channelLinkId: string }> {
  const channelLinkId = normalizeDeliverectChannelLinkId(input.channelLinkId);
  if (!channelLinkId) {
    throw new Error("channelLinkId is required.");
  }

  const vendor = await db.vendor.findUnique({
    where: { id: input.vendorId },
    select: { id: true, deliverectChannelLinkId: true },
  });
  if (!vendor) {
    throw new Error("Vendor not found.");
  }

  const existing = vendor.deliverectChannelLinkId?.trim() || null;
  if (existing && existing !== channelLinkId) {
    throw new Error(
      `Target vendor already has channel link ${existing}. Disconnect first or use force transfer.`
    );
  }

  const locationId = normalizeDeliverectLocationId(input.locationId);
  const accountId = input.accountId?.trim() || null;
  const accountEmail = input.accountEmail?.trim() || null;

  await db.vendor.update({
    where: { id: input.vendorId },
    data: {
      deliverectChannelLinkId: channelLinkId,
      ...(locationId ? { deliverectLocationId: locationId } : {}),
      ...(accountId ? { deliverectAccountId: accountId } : {}),
      ...(accountEmail ? { deliverectAccountEmail: accountEmail } : {}),
      posConnectionStatus: PosConnectionStatus.connected,
      pendingDeliverectConnectionKey: null,
      deliverectAutoMapLastAt: new Date(),
      deliverectAutoMapLastOutcome: input.outcome ?? "manual_reconnect",
      deliverectAutoMapLastDetail: input.detail ?? null,
    },
  });

  return { vendorId: input.vendorId, channelLinkId };
}

export type ManualReconnectInput = {
  targetVendorId: string;
  channelLinkId: string;
  locationId?: string | null;
  accountId?: string | null;
  accountEmail?: string | null;
  forceTransfer: boolean;
};

export type ManualReconnectResult =
  | {
      ok: true;
      targetVendorId: string;
      channelLinkId: string;
      disconnectedVendors: Array<{ vendorId: string; vendorName: string }>;
    }
  | {
      ok: false;
      error: string;
      conflicts?: DeliverectConnectionOwner[];
    };

export async function adminManualReconnectDeliverect(
  db: PrismaClient,
  input: ManualReconnectInput
): Promise<ManualReconnectResult> {
  const targetVendorId = input.targetVendorId.trim();
  const channelLinkId = normalizeDeliverectChannelLinkId(input.channelLinkId);
  const locationId = normalizeDeliverectLocationId(input.locationId);

  if (!targetVendorId || !channelLinkId) {
    return { ok: false, error: "Target vendor id and channel link id are required." };
  }

  const target = await db.vendor.findUnique({
    where: { id: targetVendorId },
    select: { id: true, name: true },
  });
  if (!target) {
    return { ok: false, error: "Target vendor not found." };
  }

  const conflicts = await findDeliverectConnectionOwners(db, {
    channelLinkId,
    locationId,
    excludeVendorId: targetVendorId,
  });

  if (conflicts.length > 0 && !input.forceTransfer) {
    return {
      ok: false,
      error:
        "Another vendor already owns this Deliverect channel link or location. Confirm force transfer to disconnect them first.",
      conflicts,
    };
  }

  const disconnectedVendors: Array<{ vendorId: string; vendorName: string }> = [];

  await db.$transaction(async (tx) => {
    for (const conflict of conflicts) {
      const d = await disconnectVendorFromDeliverect(tx, conflict.vendorId);
      disconnectedVendors.push(d);
    }

    await connectVendorToDeliverect(tx, {
      vendorId: targetVendorId,
      channelLinkId,
      locationId,
      accountId: input.accountId,
      accountEmail: input.accountEmail,
      outcome: "manual_reconnect",
      detail:
        disconnectedVendors.length > 0
          ? `transferred_from=${disconnectedVendors.map((v) => v.vendorId).join(",")}`
          : null,
    });
  });

  return {
    ok: true,
    targetVendorId,
    channelLinkId,
    disconnectedVendors,
  };
}

export type ApplyStoredPayloadInput = {
  webhookEventId: string;
  targetVendorId: string;
  forceTransfer: boolean;
};

export type ApplyStoredPayloadResult =
  | {
      ok: true;
      outcome: string;
      targetVendorId: string;
      channelLinkId: string;
      disconnectedVendors: Array<{ vendorId: string; vendorName: string }>;
    }
  | {
      ok: false;
      error: string;
      conflicts?: DeliverectConnectionOwner[];
    };

export async function adminApplyStoredChannelRegistrationPayload(
  db: PrismaClient,
  input: ApplyStoredPayloadInput
): Promise<ApplyStoredPayloadResult> {
  const webhookEventId = input.webhookEventId.trim();
  const targetVendorId = input.targetVendorId.trim();
  if (!webhookEventId || !targetVendorId) {
    return { ok: false, error: "Webhook event id and target vendor id are required." };
  }

  const ev = await db.webhookEvent.findUnique({
    where: { id: webhookEventId },
    select: { id: true, provider: true, payload: true },
  });
  if (!ev || ev.provider !== "deliverect_channel_registration") {
    return { ok: false, error: "Webhook event not found or not a channel registration event." };
  }

  const payload = ev.payload as Record<string, unknown>;
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Invalid stored payload." };
  }

  const extract = parseChannelRegistrationPayload(payload);
  if (!extract.channelLinkId) {
    return { ok: false, error: "Stored payload has no channelLinkId." };
  }

  const target = await db.vendor.findUnique({
    where: { id: targetVendorId },
    select: { id: true, name: true },
  });
  if (!target) {
    return { ok: false, error: "Target vendor not found." };
  }

  const channelLinkId = normalizeDeliverectChannelLinkId(extract.channelLinkId);
  const locationId = normalizeDeliverectLocationId(extract.deliverectPortalLocationId);

  const conflicts = await findDeliverectConnectionOwners(db, {
    channelLinkId,
    locationId,
    excludeVendorId: targetVendorId,
  });

  if (conflicts.length > 0 && !input.forceTransfer) {
    return {
      ok: false,
      error:
        "Another vendor owns this channel link or location from the payload. Use force transfer or disconnect them first.",
      conflicts,
    };
  }

  const disconnectedVendors: Array<{ vendorId: string; vendorName: string }> = [];
  let appliedOutcome = "success";

  await db.$transaction(async (tx) => {
    for (const conflict of conflicts) {
      disconnectedVendors.push(await disconnectVendorFromDeliverect(tx, conflict.vendorId));
    }

    const normalizedExtract: ChannelRegistrationExtract = {
      ...extract,
      channelLinkId,
      deliverectPortalLocationId: locationId,
    };

    const applied = await applyChannelRegistrationToVendor(tx, targetVendorId, normalizedExtract);
    if (applied.outcome === "error") {
      throw new Error(applied.message);
    }
    if (applied.outcome === "channel_link_conflict") {
      throw new Error(
        `Target vendor already has channel link ${applied.existingChannelLinkId}. Disconnect target first.`
      );
    }
    appliedOutcome = applied.outcome === "already_connected" ? "already_connected" : "admin_payload_apply";
  });

  return {
    ok: true,
    outcome: appliedOutcome,
    targetVendorId,
    channelLinkId,
    disconnectedVendors,
  };
}

/** Resolve vendor currently mapped to a channel link id, if any. */
export async function findVendorByChannelLinkId(
  db: DbClient,
  channelLinkId: string | null | undefined
): Promise<DeliverectConnectionOwner | null> {
  const id = channelLinkId?.trim();
  if (!id) return null;
  const row = await db.vendor.findFirst({
    where: { deliverectChannelLinkId: normalizeDeliverectChannelLinkId(id) },
    select: {
      id: true,
      name: true,
      deliverectChannelLinkId: true,
      deliverectLocationId: true,
      posConnectionStatus: true,
    },
  });
  if (!row) return null;
  return {
    vendorId: row.id,
    vendorName: row.name,
    deliverectChannelLinkId: row.deliverectChannelLinkId,
    deliverectLocationId: row.deliverectLocationId,
    posConnectionStatus: row.posConnectionStatus,
  };
}

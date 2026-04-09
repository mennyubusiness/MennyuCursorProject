/**
 * Deliverect busy mode webhook → Mennyu vendor pause / busy-orange delay.
 * @see https://developers.deliverect.com/reference/post-busy-mode
 */
import { prisma } from "@/lib/db";
import { nonEmptyStringField } from "@/integrations/deliverect/webhook-inbound-shared";
import { logDeliverectBusyModeWebhook } from "@/integrations/deliverect/deliverect-aux-webhook-log";

export type DeliverectBusyModeStatus = "PAUSED" | "ONLINE" | "BUSY";

function parseBusyStatus(raw: unknown): DeliverectBusyModeStatus | null {
  const s = nonEmptyStringField(raw)?.toUpperCase();
  if (s === "PAUSED" || s === "ONLINE" || s === "BUSY") return s;
  return null;
}

export type ApplyDeliverectBusyModeResult =
  | {
      ok: true;
      status: DeliverectBusyModeStatus;
      vendorIds: string[];
      mennyuOrdersPaused: boolean;
      deliverectBusyDelayMinutes: number | null;
    }
  | { ok: false; error: "vendor_not_found" | "invalid_status"; detail?: string };

/**
 * Maps Deliverect busy mode to Vendor.mennyuOrdersPaused and Vendor.deliverectBusyDelayMinutes.
 * - PAUSED: pause new Mennyu orders; clear orange delay.
 * - ONLINE: resume; clear orange delay.
 * - BUSY (orange): keep orders open; enforce minimum extra lead time via deliverectBusyDelayMinutes (from `delay`, default 30).
 */
export async function applyDeliverectBusyModeFromPayload(parsed: Record<string, unknown>): Promise<ApplyDeliverectBusyModeResult> {
  const status = parseBusyStatus(parsed.status);
  if (!status) {
    logDeliverectBusyModeWebhook("invalid_status", { raw: parsed.status ?? null });
    return { ok: false, error: "invalid_status", detail: String(parsed.status ?? "") };
  }

  const channelLinkId = nonEmptyStringField(parsed.channelLinkId);
  const locationId = nonEmptyStringField(parsed.locationId);

  if (!channelLinkId) {
    logDeliverectBusyModeWebhook("vendor_not_found", { reason: "missing_channelLinkId" });
    return { ok: false, error: "vendor_not_found", detail: "missing_channelLinkId" };
  }

  let vendors = await prisma.vendor.findMany({
    where: { deliverectChannelLinkId: channelLinkId },
    select: { id: true, deliverectLocationId: true },
  });

  if (vendors.length > 1 && locationId) {
    const narrowed = vendors.filter(
      (v) => v.deliverectLocationId === locationId || v.id === locationId
    );
    if (narrowed.length > 0) {
      vendors = narrowed;
    }
  }

  if (vendors.length === 0) {
    logDeliverectBusyModeWebhook("vendor_not_found", { channelLinkId, locationId: locationId ?? null });
    return { ok: false, error: "vendor_not_found" };
  }

  const delayRaw = parsed.delay;
  const delayMinutes =
    typeof delayRaw === "number" && Number.isFinite(delayRaw) && delayRaw >= 0
      ? Math.min(Math.floor(delayRaw), 24 * 60)
      : 30;

  const data =
    status === "PAUSED"
      ? { mennyuOrdersPaused: true, deliverectBusyDelayMinutes: null as number | null }
      : status === "ONLINE"
        ? { mennyuOrdersPaused: false, deliverectBusyDelayMinutes: null as number | null }
        : {
            mennyuOrdersPaused: false,
            deliverectBusyDelayMinutes: delayMinutes,
          };

  await prisma.vendor.updateMany({
    where: { id: { in: vendors.map((v) => v.id) } },
    data,
  });

  logDeliverectBusyModeWebhook("applied", {
    status,
    vendorIds: vendors.map((v) => v.id),
    mennyuOrdersPaused: data.mennyuOrdersPaused,
    deliverectBusyDelayMinutes: data.deliverectBusyDelayMinutes,
  });

  return {
    ok: true,
    status,
    vendorIds: vendors.map((v) => v.id),
    mennyuOrdersPaused: data.mennyuOrdersPaused,
    deliverectBusyDelayMinutes: data.deliverectBusyDelayMinutes,
  };
}

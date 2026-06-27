/**
 * Webhook health visibility for Stripe, Deliverect, and Twilio (when logged).
 */
import "server-only";

import { prisma } from "@/lib/db";
import { HEALTH_WINDOW_24H_MS } from "@/lib/admin-health-thresholds";

export type AdminWebhookProvider = "stripe" | "deliverect" | "twilio" | "other";

export type AdminWebhookHealthSummary = {
  stripeFailed24h: number;
  deliverectFailed24h: number;
  twilioFailed24h: number | null;
  stripeLastSuccessAt: Date | null;
  deliverectLastSuccessAt: Date | null;
  webhookLoggingConfigured: boolean;
  replayConfigured: boolean;
};

export type AdminWebhookEventRow = {
  id: string;
  provider: AdminWebhookProvider;
  externalEventId: string | null;
  eventType: string | null;
  status: "received" | "processed" | "failed" | "ignored";
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  errorMessage: string | null;
  createdAt: Date;
  processedAt: Date | null;
  adminHref: string | null;
};

export type AdminWebhookSearchParams = {
  provider?: AdminWebhookProvider | "all";
  status?: "processed" | "failed" | "all";
  eventType?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
};

function normalizeProvider(raw: string): AdminWebhookProvider {
  const lower = raw.toLowerCase();
  if (lower.includes("stripe")) return "stripe";
  if (lower.includes("deliverect")) return "deliverect";
  if (lower.includes("twilio")) return "twilio";
  return "other";
}

function inferEventType(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  if (typeof obj.type === "string") return obj.type;
  if (typeof obj.eventType === "string") return obj.eventType;
  if (typeof obj.status === "string") return obj.status;
  return null;
}

function inferRelatedEntity(payload: unknown): { type: string | null; id: string | null } {
  if (!payload || typeof payload !== "object") return { type: null, id: null };
  const obj = payload as Record<string, unknown>;
  const data = obj.data as Record<string, unknown> | undefined;
  const metadata = (data?.object as Record<string, unknown> | undefined)?.metadata as
    | Record<string, unknown>
    | undefined;
  if (metadata?.orderId && typeof metadata.orderId === "string") {
    return { type: "order", id: metadata.orderId };
  }
  if (typeof obj.orderId === "string") return { type: "order", id: obj.orderId };
  if (typeof obj.vendorOrderId === "string") return { type: "vendor_order", id: obj.vendorOrderId };
  return { type: null, id: null };
}

export async function getAdminWebhookHealthSummary(): Promise<AdminWebhookHealthSummary> {
  const since24h = new Date(Date.now() - HEALTH_WINDOW_24H_MS);

  const [events, stripeLastSuccess, deliverectLastSuccess] = await Promise.all([
    prisma.webhookEvent.findMany({
      where: { createdAt: { gte: since24h } },
      select: { provider: true, processed: true, errorMessage: true, processedAt: true, createdAt: true },
      take: 5000,
    }),
    prisma.webhookEvent.findFirst({
      where: { provider: { contains: "stripe", mode: "insensitive" }, processed: true },
      orderBy: { processedAt: "desc" },
      select: { processedAt: true },
    }),
    prisma.webhookEvent.findFirst({
      where: { provider: { contains: "deliverect", mode: "insensitive" }, processed: true },
      orderBy: { processedAt: "desc" },
      select: { processedAt: true },
    }),
  ]);

  let stripeFailed24h = 0;
  let deliverectFailed24h = 0;
  let twilioFailed24h: number | null = null;
  let twilioSeen = false;

  for (const ev of events) {
    const provider = normalizeProvider(ev.provider);
    const failed = !ev.processed || Boolean(ev.errorMessage);
    if (provider === "stripe" && failed) stripeFailed24h++;
    if (provider === "deliverect" && failed) deliverectFailed24h++;
    if (provider === "twilio") {
      twilioSeen = true;
      if (twilioFailed24h == null) twilioFailed24h = 0;
      if (failed) twilioFailed24h++;
    }
  }

  return {
    stripeFailed24h,
    deliverectFailed24h,
    twilioFailed24h: twilioSeen ? twilioFailed24h : null,
    stripeLastSuccessAt: stripeLastSuccess?.processedAt ?? null,
    deliverectLastSuccessAt: deliverectLastSuccess?.processedAt ?? null,
    webhookLoggingConfigured: true,
    replayConfigured: false,
  };
}

export async function searchAdminWebhookEvents(
  params: AdminWebhookSearchParams
): Promise<{ rows: AdminWebhookEventRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, params.pageSize ?? 50));
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (params.provider && params.provider !== "all") {
    where.provider = { contains: params.provider, mode: "insensitive" };
  }
  if (params.status === "processed") {
    where.processed = true;
    where.errorMessage = null;
  } else if (params.status === "failed") {
    where.OR = [{ processed: false }, { errorMessage: { not: null } }];
  }
  if (params.from || params.to) {
    where.createdAt = {
      ...(params.from ? { gte: params.from } : {}),
      ...(params.to ? { lte: params.to } : {}),
    };
  }

  const [total, events] = await Promise.all([
    prisma.webhookEvent.count({ where }),
    prisma.webhookEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        provider: true,
        eventId: true,
        payload: true,
        processed: true,
        processedAt: true,
        errorMessage: true,
        createdAt: true,
      },
    }),
  ]);

  const rows: AdminWebhookEventRow[] = [];
  for (const ev of events) {
    const provider = normalizeProvider(ev.provider);
    const eventType = inferEventType(ev.payload);
    if (params.eventType && eventType && !eventType.toLowerCase().includes(params.eventType.toLowerCase())) {
      continue;
    }
    const related = inferRelatedEntity(ev.payload);
    const failed = !ev.processed || Boolean(ev.errorMessage);
    const status: AdminWebhookEventRow["status"] = failed
      ? "failed"
      : ev.processed
        ? "processed"
        : "received";

    let adminHref: string | null = null;
    if (related.type === "order" && related.id) adminHref = `/admin/orders/${related.id}`;
    if (related.type === "vendor_order" && related.id) {
      adminHref = `/admin/deliverect-webhook-incidents?q=${encodeURIComponent(related.id)}`;
    }

    rows.push({
      id: ev.id,
      provider,
      externalEventId: ev.eventId,
      eventType,
      status,
      relatedEntityType: related.type,
      relatedEntityId: related.id,
      errorMessage: ev.errorMessage,
      createdAt: ev.createdAt,
      processedAt: ev.processedAt,
      adminHref,
    });
  }

  return { rows, total, page, pageSize };
}

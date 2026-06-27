/**
 * Admin SMS / notification log search — read-only visibility for ops triage.
 */
import "server-only";

import { prisma } from "@/lib/db";

export type AdminNotificationSearchParams = {
  status?: string;
  eventType?: string;
  phone?: string;
  orderId?: string;
  vendorOrderId?: string;
  errorCode?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
};

export type AdminNotificationRow = {
  id: string;
  createdAt: Date;
  sentAt: Date | null;
  eventType: string;
  status: string;
  recipientMasked: string;
  orderId: string | null;
  vendorOrderId: string | null;
  providerMessageId: string | null;
  errorCode: string | null;
  failureMessage: string | null;
  idempotencyKey: string | null;
  suppressionReason: string | null;
  adminHref: string | null;
};

const OTP_EVENT_TYPES = new Set(["PHONE_VERIFICATION", "phone_verification"]);

export function maskPhoneForDisplay(toMasked: string, toLast4: string | null): string {
  if (toMasked.includes("*")) return toMasked;
  if (toLast4) return `***-***-${toLast4}`;
  return toMasked.length > 4 ? `***${toMasked.slice(-4)}` : "***";
}

export function isOtpNotificationEvent(eventType: string): boolean {
  return OTP_EVENT_TYPES.has(eventType) || eventType.toLowerCase().includes("verification");
}

export function deriveSuppressionReason(status: string, failureMessage: string | null): string | null {
  if (status === "suppressed" || status === "skipped") {
    return failureMessage ?? "Suppressed before send";
  }
  if (status === "dry_run") return "Dry run mode (no Twilio send)";
  return null;
}

export async function searchAdminNotifications(
  params: AdminNotificationSearchParams
): Promise<{ rows: AdminNotificationRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, params.pageSize ?? 50));
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (params.status) where.status = params.status;
  if (params.eventType) where.eventType = { contains: params.eventType, mode: "insensitive" };
  if (params.orderId) where.orderId = params.orderId;
  if (params.vendorOrderId) where.vendorOrderId = params.vendorOrderId;
  if (params.errorCode) where.errorCode = params.errorCode;
  if (params.phone) {
    where.OR = [
      { toMasked: { contains: params.phone } },
      { toLast4: { contains: params.phone.replace(/\D/g, "").slice(-4) } },
    ];
  }
  if (params.from || params.to) {
    where.createdAt = {
      ...(params.from ? { gte: params.from } : {}),
      ...(params.to ? { lte: params.to } : {}),
    };
  }

  const [total, logs] = await Promise.all([
    prisma.smsMessageLog.count({ where }),
    prisma.smsMessageLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        createdAt: true,
        sentAt: true,
        eventType: true,
        status: true,
        toMasked: true,
        toLast4: true,
        orderId: true,
        vendorOrderId: true,
        providerMessageId: true,
        errorCode: true,
        failureMessage: true,
        idempotencyKey: true,
      },
    }),
  ]);

  const rows: AdminNotificationRow[] = logs.map((log) => ({
    id: log.id,
    createdAt: log.createdAt,
    sentAt: log.sentAt,
    eventType: log.eventType,
    status: log.status,
    recipientMasked: maskPhoneForDisplay(log.toMasked, log.toLast4),
    orderId: log.orderId,
    vendorOrderId: log.vendorOrderId,
    providerMessageId: log.providerMessageId,
    errorCode: log.errorCode,
    failureMessage: isOtpNotificationEvent(log.eventType) ? null : log.failureMessage,
    idempotencyKey: log.idempotencyKey,
    suppressionReason: deriveSuppressionReason(log.status, log.failureMessage),
    adminHref: log.orderId ? `/admin/orders/${log.orderId}` : null,
  }));

  return { rows, total, page, pageSize };
}

export async function countSmsHealthMetrics(since: Date): Promise<{
  attempted: number;
  failed: number;
  suppressedConsent: number;
  suppressedOptOut: number;
}> {
  const [attempted, failed, suppressed, skipped] = await Promise.all([
    prisma.smsMessageLog.count({ where: { createdAt: { gte: since } } }),
    prisma.smsMessageLog.count({
      where: { createdAt: { gte: since }, status: { in: ["failed", "undelivered"] } },
    }),
    prisma.smsMessageLog.count({
      where: {
        createdAt: { gte: since },
        status: { in: ["suppressed", "skipped"] },
        OR: [
          { failureMessage: { contains: "consent", mode: "insensitive" } },
          { failureMessage: { contains: "opt-in", mode: "insensitive" } },
        ],
      },
    }),
    prisma.smsMessageLog.count({
      where: {
        createdAt: { gte: since },
        status: { in: ["suppressed", "skipped"] },
        OR: [
          { failureMessage: { contains: "opt-out", mode: "insensitive" } },
          { failureMessage: { contains: "STOP", mode: "insensitive" } },
        ],
      },
    }),
  ]);

  return {
    attempted,
    failed,
    suppressedConsent: suppressed,
    suppressedOptOut: skipped,
  };
}

export const SMS_STATUS_FILTER_OPTIONS = [
  "sent",
  "delivered",
  "failed",
  "undelivered",
  "suppressed",
  "skipped",
  "pending",
  "queued",
  "logged",
  "dry_run",
] as const;

export const SMS_EVENT_TYPE_HINTS = [
  "ORDER_RECEIVED",
  "PREPARING",
  "READY",
  "COMPLETED",
  "ISSUE",
  "PHONE_VERIFICATION",
] as const;

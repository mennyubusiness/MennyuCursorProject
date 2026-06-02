/**
 * Atomic SmsMessageLog reservation — reserve before Twilio, update after send.
 */
import "server-only";

import { prisma } from "@/lib/db";

const BODY_PREVIEW_MAX = 240;

/** Statuses that mean this idempotency key must not send again. */
export const SMS_LOG_DEDUP_STATUSES = new Set([
  "pending",
  "sent",
  "queued",
  "logged",
  "delivered",
  "suppressed",
  "skipped",
  "dry_run",
]);

export function bodyPreviewForSmsLog(body: string): string {
  const t = body.trim();
  if (t.length <= BODY_PREVIEW_MAX) return t;
  return `${t.slice(0, BODY_PREVIEW_MAX - 1)}…`;
}

export function isPrismaUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  );
}

export type SmsLogReservation =
  | { outcome: "proceed"; logId: string }
  | {
      outcome: "duplicate";
      status: string;
      providerMessageId: string | null;
      reason: "duplicate_idempotency_key" | "duplicate_in_flight";
    };

export type ReserveSmsMessageLogInput = {
  orderId?: string | null;
  vendorOrderId?: string | null;
  userId?: string | null;
  toMasked: string;
  toLast4: string | null;
  eventType: string;
  body: string;
  status: string;
  failureMessage?: string | null;
  errorCode?: string | null;
  idempotencyKey: string;
  sentAt?: Date | null;
};

/**
 * Reserve a log row by unique idempotencyKey before any outbound send attempt.
 * Safe order: create/reserve → send → finalize.
 */
export async function reserveSmsMessageLog(
  input: ReserveSmsMessageLogInput
): Promise<SmsLogReservation> {
  try {
    const row = await prisma.smsMessageLog.create({
      data: {
        orderId: input.orderId ?? null,
        vendorOrderId: input.vendorOrderId ?? null,
        userId: input.userId ?? null,
        toMasked: input.toMasked,
        toLast4: input.toLast4,
        eventType: input.eventType,
        bodyPreview: bodyPreviewForSmsLog(input.body),
        provider: "twilio",
        status: input.status,
        failureMessage: input.failureMessage ?? null,
        errorCode: input.errorCode ?? null,
        idempotencyKey: input.idempotencyKey,
        sentAt: input.sentAt ?? null,
      },
      select: { id: true },
    });
    return { outcome: "proceed", logId: row.id };
  } catch (error) {
    if (!isPrismaUniqueViolation(error)) {
      throw error;
    }
    return handleSmsLogReservationConflict(input);
  }
}

async function handleSmsLogReservationConflict(
  input: ReserveSmsMessageLogInput
): Promise<SmsLogReservation> {
  const existing = await prisma.smsMessageLog.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: { id: true, status: true, providerMessageId: true },
  });

  if (!existing) {
    return reserveSmsMessageLog(input);
  }

  if (existing.status === "failed") {
    const reclaimed = await prisma.smsMessageLog.updateMany({
      where: { id: existing.id, status: "failed" },
      data: {
        status: input.status,
        failureMessage: input.failureMessage ?? null,
        errorCode: input.errorCode ?? null,
        toMasked: input.toMasked,
        toLast4: input.toLast4,
        bodyPreview: bodyPreviewForSmsLog(input.body),
        providerMessageId: null,
        sentAt: input.sentAt ?? null,
      },
    });
    if (reclaimed.count === 1) {
      return { outcome: "proceed", logId: existing.id };
    }
    const refreshed = await prisma.smsMessageLog.findUnique({
      where: { id: existing.id },
      select: { status: true, providerMessageId: true },
    });
    if (refreshed && SMS_LOG_DEDUP_STATUSES.has(refreshed.status)) {
      return {
        outcome: "duplicate",
        status: refreshed.status,
        providerMessageId: refreshed.providerMessageId,
        reason:
          refreshed.status === "pending" ? "duplicate_in_flight" : "duplicate_idempotency_key",
      };
    }
  }

  if (SMS_LOG_DEDUP_STATUSES.has(existing.status)) {
    return {
      outcome: "duplicate",
      status: existing.status,
      providerMessageId: existing.providerMessageId,
      reason: existing.status === "pending" ? "duplicate_in_flight" : "duplicate_idempotency_key",
    };
  }

  return {
    outcome: "duplicate",
    status: existing.status,
    providerMessageId: existing.providerMessageId,
    reason: "duplicate_idempotency_key",
  };
}

export async function finalizeSmsMessageLog(
  logId: string,
  data: {
    status: string;
    providerMessageId?: string | null;
    errorCode?: string | null;
    failureMessage?: string | null;
    sentAt?: Date | null;
  }
): Promise<void> {
  await prisma.smsMessageLog.update({
    where: { id: logId },
    data: {
      status: data.status,
      providerMessageId: data.providerMessageId ?? null,
      errorCode: data.errorCode ?? null,
      failureMessage: data.failureMessage ?? null,
      sentAt: data.sentAt ?? null,
    },
  });
}

/** Non-idempotent audit row when no idempotency key is supplied. */
export async function createSmsMessageLogWithoutKey(input: Omit<ReserveSmsMessageLogInput, "idempotencyKey">) {
  return prisma.smsMessageLog.create({
    data: {
      orderId: input.orderId ?? null,
      vendorOrderId: input.vendorOrderId ?? null,
      userId: input.userId ?? null,
      toMasked: input.toMasked,
      toLast4: input.toLast4,
      eventType: input.eventType,
      bodyPreview: bodyPreviewForSmsLog(input.body),
      provider: "twilio",
      status: input.status,
      failureMessage: input.failureMessage ?? null,
      errorCode: input.errorCode ?? null,
      sentAt: input.sentAt ?? null,
    },
    select: { id: true },
  });
}

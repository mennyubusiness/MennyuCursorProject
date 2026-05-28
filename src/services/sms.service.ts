/**
 * Central transactional SMS via Twilio (order updates, future issue notifications).
 */
import "server-only";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import {
  isLikelyE164Phone,
  maskPhone,
  normalizeUsPhoneToE164,
  phoneLast4,
} from "@/lib/phone";
import {
  isSmsDryRun,
  isSmsEnabled,
  isSmsLogOnly,
  shouldSendViaTwilio,
  smsOperationalError,
} from "@/lib/sms-config";
import { getPickupCode } from "@/lib/pickup-code";
import { sendTwilioMessage } from "@/lib/twilio";
import type { ParentOrderStatus } from "@/domain/types";
import { parentStatusLabel } from "@/domain/order-state";

export type SmsDeliveryStatus = "sent" | "skipped" | "failed" | "dry_run";

export type SendTransactionalSmsInput = {
  to: string;
  body: string;
  orderId?: string | null;
  vendorOrderId?: string | null;
  eventType: string;
  idempotencyKey?: string | null;
  /** When true, throws on failed send (not used by order flows). */
  strict?: boolean;
};

export type SendTransactionalSmsResult = {
  status: SmsDeliveryStatus;
  providerMessageId: string | null;
  failureMessage: string | null;
  destinationMasked: string;
};

const BODY_PREVIEW_MAX = 240;

function bodyPreview(body: string): string {
  const t = body.trim();
  if (t.length <= BODY_PREVIEW_MAX) return t;
  return `${t.slice(0, BODY_PREVIEW_MAX - 1)}…`;
}

function publicOrderBaseUrl(): string {
  return env.PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://mennyu.com";
}

async function findCommittedSmsLog(idempotencyKey: string) {
  return prisma.smsMessageLog.findUnique({
    where: { idempotencyKey },
    select: { status: true, providerMessageId: true },
  });
}

async function writeSmsLog(input: {
  orderId?: string | null;
  vendorOrderId?: string | null;
  toMasked: string;
  toLast4: string | null;
  eventType: string;
  body: string;
  status: SmsDeliveryStatus;
  providerMessageId?: string | null;
  failureMessage?: string | null;
  idempotencyKey?: string | null;
  sentAt?: Date | null;
}) {
  try {
    await prisma.smsMessageLog.create({
      data: {
        orderId: input.orderId ?? null,
        vendorOrderId: input.vendorOrderId ?? null,
        toMasked: input.toMasked,
        toLast4: input.toLast4,
        eventType: input.eventType,
        bodyPreview: bodyPreview(input.body),
        provider: "twilio",
        providerMessageId: input.providerMessageId ?? null,
        status: input.status,
        failureMessage: input.failureMessage ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        sentAt: input.sentAt ?? null,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(
      JSON.stringify({
        event: "sms_log_write_failed",
        eventType: input.eventType,
        orderId: input.orderId,
        message: msg,
      })
    );
  }
}

/**
 * Send a transactional SMS with idempotency, env guards, and audit logging.
 */
export async function sendTransactionalSms(
  input: SendTransactionalSmsInput
): Promise<SendTransactionalSmsResult> {
  const rawTo = input.to?.trim() ?? "";
  const masked = rawTo ? maskPhone(rawTo) : "***";
  const last4 = rawTo ? phoneLast4(rawTo) : null;

  if (!rawTo) {
    await writeSmsLog({
      orderId: input.orderId,
      vendorOrderId: input.vendorOrderId,
      toMasked: masked,
      toLast4: last4,
      eventType: input.eventType,
      body: input.body,
      status: "skipped",
      failureMessage: "missing_destination_phone",
      idempotencyKey: input.idempotencyKey,
    });
    return {
      status: "skipped",
      providerMessageId: null,
      failureMessage: "missing_destination_phone",
      destinationMasked: masked,
    };
  }

  const e164 = isLikelyE164Phone(rawTo)
    ? rawTo
    : normalizeUsPhoneToE164(rawTo);

  if (!e164) {
    await writeSmsLog({
      orderId: input.orderId,
      vendorOrderId: input.vendorOrderId,
      toMasked: masked,
      toLast4: last4,
      eventType: input.eventType,
      body: input.body,
      status: "skipped",
      failureMessage: "invalid_phone_number",
      idempotencyKey: input.idempotencyKey,
    });
    return {
      status: "skipped",
      providerMessageId: null,
      failureMessage: "invalid_phone_number",
      destinationMasked: masked,
    };
  }

  const destinationMasked = maskPhone(e164);

  if (input.idempotencyKey) {
    const existing = await findCommittedSmsLog(input.idempotencyKey);
    if (existing && (existing.status === "sent" || existing.status === "dry_run")) {
      return {
        status: "skipped",
        providerMessageId: existing.providerMessageId,
        failureMessage: "duplicate_idempotency_key",
        destinationMasked,
      };
    }
  }

  if (!isSmsEnabled()) {
    await writeSmsLog({
      orderId: input.orderId,
      vendorOrderId: input.vendorOrderId,
      toMasked: destinationMasked,
      toLast4: phoneLast4(e164),
      eventType: input.eventType,
      body: input.body,
      status: "skipped",
      failureMessage: "sms_disabled",
      idempotencyKey: input.idempotencyKey,
    });
    return {
      status: "skipped",
      providerMessageId: null,
      failureMessage: "sms_disabled",
      destinationMasked,
    };
  }

  if (isSmsDryRun() || isSmsLogOnly() || !shouldSendViaTwilio()) {
    const reason = isSmsDryRun()
      ? "dry_run"
      : isSmsLogOnly()
        ? "log_only"
        : smsOperationalError() ?? "twilio_not_configured";
    await writeSmsLog({
      orderId: input.orderId,
      vendorOrderId: input.vendorOrderId,
      toMasked: destinationMasked,
      toLast4: phoneLast4(e164),
      eventType: input.eventType,
      body: input.body,
      status: "dry_run",
      failureMessage: reason,
      idempotencyKey: input.idempotencyKey,
      sentAt: new Date(),
    });
    if (env.NODE_ENV === "production" && reason.includes("missing")) {
      console.error(
        JSON.stringify({
          event: "sms_operational_error",
          eventType: input.eventType,
          orderId: input.orderId,
          reason,
        })
      );
    }
    return {
      status: "dry_run",
      providerMessageId: null,
      failureMessage: reason,
      destinationMasked,
    };
  }

  const twilioResult = await sendTwilioMessage({ to: e164, body: input.body });
  if ("error" in twilioResult) {
    await writeSmsLog({
      orderId: input.orderId,
      vendorOrderId: input.vendorOrderId,
      toMasked: destinationMasked,
      toLast4: phoneLast4(e164),
      eventType: input.eventType,
      body: input.body,
      status: "failed",
      failureMessage: twilioResult.error,
      idempotencyKey: input.idempotencyKey,
    });
    console.warn(
      JSON.stringify({
        event: "sms_send_failed",
        eventType: input.eventType,
        orderId: input.orderId,
        vendorOrderId: input.vendorOrderId,
        destinationMasked,
        message: twilioResult.error,
      })
    );
    if (input.strict) {
      throw new Error(`SMS send failed: ${twilioResult.error}`);
    }
    return {
      status: "failed",
      providerMessageId: null,
      failureMessage: twilioResult.error,
      destinationMasked,
    };
  }

  await writeSmsLog({
    orderId: input.orderId,
    vendorOrderId: input.vendorOrderId,
    toMasked: destinationMasked,
    toLast4: phoneLast4(e164),
    eventType: input.eventType,
    body: input.body,
    status: "sent",
    providerMessageId: twilioResult.sid,
    idempotencyKey: input.idempotencyKey,
    sentAt: new Date(),
  });

  return {
    status: "sent",
    providerMessageId: twilioResult.sid,
    failureMessage: null,
    destinationMasked,
  };
}

/** @deprecated Prefer sendTransactionalSms. */
export async function sendSms(
  to: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  const r = await sendTransactionalSms({
    to,
    body,
    eventType: "legacy_send_sms",
  });
  return {
    success: r.status === "sent" || r.status === "dry_run",
    error: r.failureMessage ?? undefined,
  };
}

export async function sendOrderConfirmation(
  phone: string,
  orderId: string,
  totalCents: number,
  pickupFragment?: string
): Promise<SendTransactionalSmsResult> {
  const total = (totalCents / 100).toFixed(2);
  const pickup = pickupFragment ? ` ${pickupFragment}.` : "";
  const shortId = orderId.slice(-8).toUpperCase();
  const body = `Your order with Open Order is confirmed. Order #${shortId}.${pickup} Total $${total}. Track status: ${publicOrderBaseUrl()}/order/${orderId}`;

  return sendTransactionalSms({
    to: phone,
    body,
    orderId,
    eventType: "order_confirmation",
    idempotencyKey: `sms:order_confirmation:${orderId}`,
  });
}

export async function sendOrderStatusUpdate(
  phone: string,
  orderId: string,
  parentStatus: ParentOrderStatus
): Promise<SendTransactionalSmsResult> {
  const shortId = orderId.slice(-8).toUpperCase();
  const url = `${publicOrderBaseUrl()}/order/${orderId}`;
  const pickupCode = getPickupCode(orderId);

  let body: string;
  let eventType: string;

  if (parentStatus === "ready") {
    eventType = "order_ready_for_pickup";
    body = `Open Order: Your order is ready for pickup. Pickup code: ${pickupCode}. Details: ${url}`;
  } else {
    eventType = `order_status_${parentStatus}`;
    body = `Open Order #${shortId}: ${parentStatusLabel(parentStatus)}. Details: ${url}`;
  }

  return sendTransactionalSms({
    to: phone,
    body,
    orderId,
    eventType,
    idempotencyKey: `sms:order_status:${orderId}:${parentStatus}`,
  });
}

/**
 * Central transactional SMS via Twilio Messaging Service.
 * Non-blocking for order flows — failures are logged, not thrown (unless strict).
 */
import "server-only";

import { env } from "@/lib/env";
import {
  isLikelyE164Phone,
  maskPhone,
  normalizeUsPhoneToE164,
  phoneLast4,
} from "@/lib/phone";
import { hasTransactionalSmsConsent, isPhoneSmsOptedOut } from "@/lib/sms-opt-out.service";
import {
  resolveSmsMode,
  shouldSendViaTwilio,
  smsOperationalError,
} from "@/lib/sms-config";
import {
  createSmsMessageLogWithoutKey,
  finalizeSmsMessageLog,
  reserveSmsMessageLog,
  type SmsLogReservation,
} from "@/lib/sms-message-log-reservation";
import {
  buildOrderCancelledSmsBody,
  buildOrderIssueSmsBody,
  buildOrderPreparingSmsBody,
  buildOrderReadySmsBody,
  buildOrderReceivedSmsBody,
  buildPhoneVerificationSmsBody,
  formatSmsOrderNumber,
  SMS_TEMPLATE_TYPES,
  type SmsTemplateType,
} from "@/lib/sms-templates";
import { getPickupCode } from "@/lib/pickup-code";
import { sendTwilioMessage } from "@/lib/twilio";
import type { ParentOrderStatus } from "@/domain/types";
import { parentStatusLabel } from "@/domain/order-state";

export type SmsDeliveryStatus =
  | "sent"
  | "skipped"
  | "failed"
  | "logged"
  | "suppressed"
  | "queued";

export type SendSmsInput = {
  to: string;
  body: string;
  type: SmsTemplateType | string;
  orderId?: string | null;
  vendorOrderId?: string | null;
  userId?: string | null;
  idempotencyKey?: string | null;
  strict?: boolean;
};

/** @deprecated Prefer SendSmsInput */
export type SendTransactionalSmsInput = {
  to: string;
  body: string;
  orderId?: string | null;
  vendorOrderId?: string | null;
  eventType: string;
  idempotencyKey?: string | null;
  strict?: boolean;
};

export type SendSmsResult = {
  status: SmsDeliveryStatus;
  providerMessageId: string | null;
  failureMessage: string | null;
  errorCode: string | null;
  destinationMasked: string;
};

function mapLogStatus(mode: ReturnType<typeof resolveSmsMode>, twilioStatus?: string): string {
  if (mode === "log") return "logged";
  if (twilioStatus === "queued" || twilioStatus === "accepted") return "queued";
  return "sent";
}

function normalizeDestination(rawTo: string): { e164: string | null; masked: string } {
  const raw = rawTo?.trim() ?? "";
  const masked = raw ? maskPhone(raw) : "***";
  if (!raw) return { e164: null, masked };
  const e164 = isLikelyE164Phone(raw) ? raw : normalizeUsPhoneToE164(raw);
  return { e164, masked };
}

function duplicateReservationResult(
  reservation: Extract<SmsLogReservation, { outcome: "duplicate" }>,
  destinationMasked: string
): SendSmsResult {
  return {
    status: "skipped",
    providerMessageId: reservation.providerMessageId,
    failureMessage: reservation.reason,
    errorCode: null,
    destinationMasked,
  };
}

type ReserveContext = {
  orderId?: string | null;
  vendorOrderId?: string | null;
  userId?: string | null;
  toMasked: string;
  toLast4: string | null;
  eventType: string;
  body: string;
  idempotencyKey?: string | null;
};

async function reserveTerminalSmsLog(
  ctx: ReserveContext,
  status: string,
  failureMessage: string,
  sentAt?: Date | null
): Promise<{ ok: true } | { ok: false; result: SendSmsResult }> {
  if (!ctx.idempotencyKey) {
    await createSmsMessageLogWithoutKey({
      orderId: ctx.orderId,
      vendorOrderId: ctx.vendorOrderId,
      userId: ctx.userId,
      toMasked: ctx.toMasked,
      toLast4: ctx.toLast4,
      eventType: ctx.eventType,
      body: ctx.body,
      status,
      failureMessage,
      sentAt: sentAt ?? null,
    });
    return { ok: true };
  }

  const reservation = await reserveSmsMessageLog({
    orderId: ctx.orderId,
    vendorOrderId: ctx.vendorOrderId,
    userId: ctx.userId,
    toMasked: ctx.toMasked,
    toLast4: ctx.toLast4,
    eventType: ctx.eventType,
    body: ctx.body,
    status,
    failureMessage,
    idempotencyKey: ctx.idempotencyKey,
    sentAt: sentAt ?? null,
  });

  if (reservation.outcome === "duplicate") {
    return { ok: false, result: duplicateReservationResult(reservation, ctx.toMasked) };
  }

  return { ok: true };
}

async function reservePendingSmsLog(
  ctx: ReserveContext
): Promise<{ ok: true; logId: string } | { ok: false; result: SendSmsResult }> {
  if (!ctx.idempotencyKey) {
    const row = await createSmsMessageLogWithoutKey({
      orderId: ctx.orderId,
      vendorOrderId: ctx.vendorOrderId,
      userId: ctx.userId,
      toMasked: ctx.toMasked,
      toLast4: ctx.toLast4,
      eventType: ctx.eventType,
      body: ctx.body,
      status: "pending",
    });
    return { ok: true, logId: row.id };
  }

  const reservation = await reserveSmsMessageLog({
    orderId: ctx.orderId,
    vendorOrderId: ctx.vendorOrderId,
    userId: ctx.userId,
    toMasked: ctx.toMasked,
    toLast4: ctx.toLast4,
    eventType: ctx.eventType,
    body: ctx.body,
    status: "pending",
    idempotencyKey: ctx.idempotencyKey,
  });

  if (reservation.outcome === "duplicate") {
    return { ok: false, result: duplicateReservationResult(reservation, ctx.toMasked) };
  }

  return { ok: true, logId: reservation.logId };
}

/**
 * Send a transactional SMS with atomic idempotency, opt-out checks, env guards, and audit logging.
 */
export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const eventType = SMS_TEMPLATE_TYPES.has(input.type as SmsTemplateType)
    ? (input.type as SmsTemplateType)
    : String(input.type);

  const { e164, masked } = normalizeDestination(input.to);

  const ctx: ReserveContext = {
    orderId: input.orderId,
    vendorOrderId: input.vendorOrderId,
    userId: input.userId,
    toMasked: masked,
    toLast4: input.to?.trim() ? phoneLast4(input.to) : null,
    eventType,
    body: input.body,
    idempotencyKey: input.idempotencyKey,
  };

  if (!e164) {
    const reason = input.to?.trim() ? "invalid_phone_number" : "missing_destination_phone";
    await reserveTerminalSmsLog(ctx, "skipped", reason);
    return {
      status: "skipped",
      providerMessageId: null,
      failureMessage: reason,
      errorCode: null,
      destinationMasked: masked,
    };
  }

  const destinationMasked = maskPhone(e164);
  ctx.toMasked = destinationMasked;
  ctx.toLast4 = phoneLast4(e164);

  const mode = resolveSmsMode();

  if (mode === "disabled") {
    const reserved = await reserveTerminalSmsLog(ctx, "skipped", "sms_disabled");
    if (!reserved.ok) return reserved.result;
    return {
      status: "skipped",
      providerMessageId: null,
      failureMessage: "sms_disabled",
      errorCode: null,
      destinationMasked,
    };
  }

  if (await isPhoneSmsOptedOut(e164)) {
    const reserved = await reserveTerminalSmsLog(ctx, "suppressed", "phone_opted_out");
    if (!reserved.ok) return reserved.result;
    return {
      status: "suppressed",
      providerMessageId: null,
      failureMessage: "phone_opted_out",
      errorCode: null,
      destinationMasked,
    };
  }

  if (eventType !== "PHONE_VERIFICATION" && !(await hasTransactionalSmsConsent(e164))) {
    const reserved = await reserveTerminalSmsLog(ctx, "skipped", "no_sms_consent");
    if (!reserved.ok) return reserved.result;
    return {
      status: "skipped",
      providerMessageId: null,
      failureMessage: "no_sms_consent",
      errorCode: null,
      destinationMasked,
    };
  }

  if (mode === "log" || !shouldSendViaTwilio()) {
    const reason =
      mode === "log" ? "sms_mode_log" : smsOperationalError() ?? "twilio_not_configured";
    const reserved = await reserveTerminalSmsLog(ctx, "logged", reason, new Date());
    if (!reserved.ok) return reserved.result;
    if (env.NODE_ENV === "production" && reason.includes("missing")) {
      console.error(
        JSON.stringify({
          event: "sms_operational_error",
          eventType,
          orderId: input.orderId,
          reason,
        })
      );
    }
    return {
      status: "logged",
      providerMessageId: null,
      failureMessage: reason,
      errorCode: null,
      destinationMasked,
    };
  }

  const pending = await reservePendingSmsLog(ctx);
  if (!pending.ok) return pending.result;

  const twilioResult = await sendTwilioMessage({ to: e164, body: input.body });
  if ("error" in twilioResult) {
    await finalizeSmsMessageLog(pending.logId, {
      status: "failed",
      errorCode: twilioResult.code ?? null,
      failureMessage: twilioResult.error,
    });
    console.warn(
      JSON.stringify({
        event: "sms_send_failed",
        eventType,
        orderId: input.orderId,
        vendorOrderId: input.vendorOrderId,
        destinationMasked,
        errorCode: twilioResult.code,
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
      errorCode: twilioResult.code ?? null,
      destinationMasked,
    };
  }

  const logStatus = mapLogStatus(mode, twilioResult.status);
  await finalizeSmsMessageLog(pending.logId, {
    status: logStatus,
    providerMessageId: twilioResult.sid,
    sentAt: new Date(),
  });

  return {
    status: logStatus === "queued" ? "queued" : "sent",
    providerMessageId: twilioResult.sid,
    failureMessage: null,
    errorCode: null,
    destinationMasked,
  };
}

/** Backward-compatible alias. */
export async function sendTransactionalSms(
  input: SendTransactionalSmsInput
): Promise<SendSmsResult> {
  return sendSms({
    to: input.to,
    body: input.body,
    type: input.eventType,
    orderId: input.orderId,
    vendorOrderId: input.vendorOrderId,
    idempotencyKey: input.idempotencyKey,
    strict: input.strict,
  });
}

export async function sendVerificationCodeSms(params: {
  to: string;
  code: string;
  userId?: string | null;
}): Promise<SendSmsResult> {
  return sendSms({
    to: params.to,
    body: buildPhoneVerificationSmsBody(params.code),
    type: "PHONE_VERIFICATION",
    userId: params.userId ?? null,
  });
}

export async function sendOrderReceivedSms(params: {
  to: string;
  orderId: string;
}): Promise<SendSmsResult> {
  const orderNumber = formatSmsOrderNumber(params.orderId);
  return sendSms({
    to: params.to,
    body: buildOrderReceivedSmsBody(orderNumber),
    type: "ORDER_RECEIVED",
    orderId: params.orderId,
    idempotencyKey: `sms:ORDER_RECEIVED:${params.orderId}`,
  });
}

export async function sendOrderPreparingSms(params: {
  to: string;
  orderId: string;
  vendorOrderId?: string | null;
}): Promise<SendSmsResult> {
  const orderNumber = formatSmsOrderNumber(params.orderId);
  const scope = params.vendorOrderId ?? params.orderId;
  return sendSms({
    to: params.to,
    body: buildOrderPreparingSmsBody(orderNumber),
    type: "ORDER_PREPARING",
    orderId: params.orderId,
    vendorOrderId: params.vendorOrderId ?? null,
    idempotencyKey: `sms:ORDER_PREPARING:${scope}`,
  });
}

export async function sendOrderReadySms(params: {
  to: string;
  orderId: string;
  vendorOrderId?: string | null;
}): Promise<SendSmsResult> {
  const orderNumber = formatSmsOrderNumber(params.orderId);
  const pickupCode = getPickupCode(params.orderId);
  const scope = params.vendorOrderId ?? params.orderId;
  return sendSms({
    to: params.to,
    body: buildOrderReadySmsBody(orderNumber, pickupCode),
    type: "ORDER_READY",
    orderId: params.orderId,
    vendorOrderId: params.vendorOrderId ?? null,
    idempotencyKey: `sms:ORDER_READY:${scope}`,
  });
}

export async function sendOrderCancelledSms(params: {
  to: string;
  orderId: string;
}): Promise<SendSmsResult> {
  const orderNumber = formatSmsOrderNumber(params.orderId);
  return sendSms({
    to: params.to,
    body: buildOrderCancelledSmsBody(orderNumber),
    type: "ORDER_CANCELLED",
    orderId: params.orderId,
    idempotencyKey: `sms:ORDER_CANCELLED:${params.orderId}`,
  });
}

export async function sendOrderIssueSms(params: {
  to: string;
  orderId: string;
  issueId: string;
}): Promise<SendSmsResult> {
  const orderNumber = formatSmsOrderNumber(params.orderId);
  return sendSms({
    to: params.to,
    body: buildOrderIssueSmsBody(orderNumber),
    type: "ORDER_ISSUE",
    orderId: params.orderId,
    idempotencyKey: `sms:ORDER_ISSUE:${params.issueId}`,
  });
}

/** @deprecated Prefer sendOrderReceivedSms. */
export async function sendOrderConfirmation(
  phone: string,
  orderId: string,
  _totalCents: number,
  _pickupFragment?: string
): Promise<SendSmsResult> {
  return sendOrderReceivedSms({ to: phone, orderId });
}

/** @deprecated Prefer typed order SMS helpers. */
export async function sendOrderStatusUpdate(
  phone: string,
  orderId: string,
  parentStatus: ParentOrderStatus
): Promise<SendSmsResult> {
  if (parentStatus === "ready") {
    return sendOrderReadySms({ to: phone, orderId });
  }
  if (parentStatus === "cancelled") {
    return sendOrderCancelledSms({ to: phone, orderId });
  }
  if (parentStatus === "preparing" || parentStatus === "accepted") {
    return sendOrderPreparingSms({ to: phone, orderId });
  }
  const orderNumber = formatSmsOrderNumber(orderId);
  return sendSms({
    to: phone,
    body: `Open Order: Update on pickup order #${orderNumber} — ${parentStatusLabel(parentStatus)}. Reply STOP to opt out.`,
    type: `ORDER_STATUS_${parentStatus}`,
    orderId,
    idempotencyKey: `sms:order_status:${orderId}:${parentStatus}`,
  });
}

/** @deprecated Prefer sendSms. */
export async function sendSmsLegacy(
  to: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  const r = await sendSms({ to, body, type: "legacy_send_sms" });
  return {
    success: ["sent", "logged", "queued"].includes(r.status),
    error: r.failureMessage ?? undefined,
  };
}

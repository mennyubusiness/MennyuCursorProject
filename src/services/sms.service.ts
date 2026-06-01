/**
 * Central transactional SMS via Twilio Messaging Service.
 * Non-blocking for order flows — failures are logged, not thrown (unless strict).
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
import { isPhoneSmsOptedOut } from "@/lib/sms-opt-out.service";
import {
  resolveSmsMode,
  shouldSendViaTwilio,
  smsOperationalError,
} from "@/lib/sms-config";
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

const BODY_PREVIEW_MAX = 240;

function bodyPreview(body: string): string {
  const t = body.trim();
  if (t.length <= BODY_PREVIEW_MAX) return t;
  return `${t.slice(0, BODY_PREVIEW_MAX - 1)}…`;
}

function mapLogStatus(mode: ReturnType<typeof resolveSmsMode>, twilioStatus?: string): string {
  if (mode === "log") return "logged";
  if (twilioStatus === "queued" || twilioStatus === "accepted") return "queued";
  return "sent";
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
  userId?: string | null;
  toMasked: string;
  toLast4: string | null;
  eventType: string;
  body: string;
  status: string;
  providerMessageId?: string | null;
  errorCode?: string | null;
  failureMessage?: string | null;
  idempotencyKey?: string | null;
  sentAt?: Date | null;
}) {
  try {
    await prisma.smsMessageLog.create({
      data: {
        orderId: input.orderId ?? null,
        vendorOrderId: input.vendorOrderId ?? null,
        userId: input.userId ?? null,
        toMasked: input.toMasked,
        toLast4: input.toLast4,
        eventType: input.eventType,
        bodyPreview: bodyPreview(input.body),
        provider: "twilio",
        providerMessageId: input.providerMessageId ?? null,
        status: input.status,
        errorCode: input.errorCode ?? null,
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

function normalizeDestination(rawTo: string): { e164: string | null; masked: string } {
  const raw = rawTo?.trim() ?? "";
  const masked = raw ? maskPhone(raw) : "***";
  if (!raw) return { e164: null, masked };
  const e164 = isLikelyE164Phone(raw) ? raw : normalizeUsPhoneToE164(raw);
  return { e164, masked };
}

/**
 * Send a transactional SMS with idempotency, opt-out checks, env guards, and audit logging.
 */
export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const eventType = SMS_TEMPLATE_TYPES.has(input.type as SmsTemplateType)
    ? (input.type as SmsTemplateType)
    : String(input.type);

  const { e164, masked } = normalizeDestination(input.to);

  if (!e164) {
    const reason = input.to?.trim() ? "invalid_phone_number" : "missing_destination_phone";
    await writeSmsLog({
      orderId: input.orderId,
      vendorOrderId: input.vendorOrderId,
      userId: input.userId,
      toMasked: masked,
      toLast4: input.to?.trim() ? phoneLast4(input.to) : null,
      eventType,
      body: input.body,
      status: "skipped",
      failureMessage: reason,
      idempotencyKey: input.idempotencyKey,
    });
    return {
      status: "skipped",
      providerMessageId: null,
      failureMessage: reason,
      errorCode: null,
      destinationMasked: masked,
    };
  }

  const destinationMasked = maskPhone(e164);

  if (input.idempotencyKey) {
    const existing = await findCommittedSmsLog(input.idempotencyKey);
    if (
      existing &&
      ["sent", "logged", "queued", "delivered", "dry_run"].includes(existing.status)
    ) {
      return {
        status: "skipped",
        providerMessageId: existing.providerMessageId,
        failureMessage: "duplicate_idempotency_key",
        errorCode: null,
        destinationMasked,
      };
    }
  }

  const mode = resolveSmsMode();

  if (mode === "disabled") {
    await writeSmsLog({
      orderId: input.orderId,
      vendorOrderId: input.vendorOrderId,
      userId: input.userId,
      toMasked: destinationMasked,
      toLast4: phoneLast4(e164),
      eventType,
      body: input.body,
      status: "skipped",
      failureMessage: "sms_disabled",
      idempotencyKey: input.idempotencyKey,
    });
    return {
      status: "skipped",
      providerMessageId: null,
      failureMessage: "sms_disabled",
      errorCode: null,
      destinationMasked,
    };
  }

  if (await isPhoneSmsOptedOut(e164)) {
    await writeSmsLog({
      orderId: input.orderId,
      vendorOrderId: input.vendorOrderId,
      userId: input.userId,
      toMasked: destinationMasked,
      toLast4: phoneLast4(e164),
      eventType,
      body: input.body,
      status: "suppressed",
      failureMessage: "phone_opted_out",
      idempotencyKey: input.idempotencyKey,
    });
    return {
      status: "suppressed",
      providerMessageId: null,
      failureMessage: "phone_opted_out",
      errorCode: null,
      destinationMasked,
    };
  }

  if (mode === "log" || !shouldSendViaTwilio()) {
    const reason =
      mode === "log" ? "sms_mode_log" : smsOperationalError() ?? "twilio_not_configured";
    await writeSmsLog({
      orderId: input.orderId,
      vendorOrderId: input.vendorOrderId,
      userId: input.userId,
      toMasked: destinationMasked,
      toLast4: phoneLast4(e164),
      eventType,
      body: input.body,
      status: "logged",
      failureMessage: reason,
      idempotencyKey: input.idempotencyKey,
      sentAt: new Date(),
    });
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

  const twilioResult = await sendTwilioMessage({ to: e164, body: input.body });
  if ("error" in twilioResult) {
    await writeSmsLog({
      orderId: input.orderId,
      vendorOrderId: input.vendorOrderId,
      userId: input.userId,
      toMasked: destinationMasked,
      toLast4: phoneLast4(e164),
      eventType,
      body: input.body,
      status: "failed",
      errorCode: twilioResult.code ?? null,
      failureMessage: twilioResult.error,
      idempotencyKey: input.idempotencyKey,
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

  await writeSmsLog({
    orderId: input.orderId,
    vendorOrderId: input.vendorOrderId,
    userId: input.userId,
    toMasked: destinationMasked,
    toLast4: phoneLast4(e164),
    eventType,
    body: input.body,
    status: logStatus,
    providerMessageId: twilioResult.sid,
    idempotencyKey: input.idempotencyKey,
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

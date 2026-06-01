/**
 * Transactional SMS copy — Open Order only, no marketing language.
 */
import { OPEN_ORDER_SUPPORT_EMAIL } from "@/lib/legal/constants";

export type SmsTemplateType =
  | "PHONE_VERIFICATION"
  | "ORDER_RECEIVED"
  | "ORDER_PREPARING"
  | "ORDER_READY"
  | "ORDER_CANCELLED"
  | "ORDER_ISSUE";

/** Short public order reference (last 8 chars of order id, uppercase). */
export function formatSmsOrderNumber(orderId: string): string {
  const trimmed = orderId.trim();
  if (trimmed.length <= 8) return trimmed.toUpperCase();
  return trimmed.slice(-8).toUpperCase();
}

export function buildPhoneVerificationSmsBody(code: string): string {
  return `Open Order: Your verification code is ${code}. This code expires in 10 minutes. Reply STOP to opt out.`;
}

export function buildOrderReceivedSmsBody(orderNumber: string): string {
  return `Open Order: Your pickup order #${orderNumber} has been received. We'll text you when it is ready. Reply STOP to opt out.`;
}

export function buildOrderPreparingSmsBody(orderNumber: string): string {
  return `Open Order: Your pickup order #${orderNumber} is being prepared. Reply STOP to opt out.`;
}

export function buildOrderReadySmsBody(orderNumber: string, pickupCode: string): string {
  return `Open Order: Your pickup order #${orderNumber} is ready for pickup. Pickup code: ${pickupCode}. Reply STOP to opt out.`;
}

export function buildOrderCancelledSmsBody(orderNumber: string): string {
  return `Open Order: Your pickup order #${orderNumber} was cancelled. Any applicable refund will be processed automatically. Reply STOP to opt out.`;
}

export function buildOrderIssueSmsBody(orderNumber: string): string {
  return `Open Order: There is an issue with pickup order #${orderNumber}. Please check your order page or contact ${OPEN_ORDER_SUPPORT_EMAIL}. Reply STOP to opt out.`;
}

/** Maps template type to SmsMessageLog eventType string. */
export function smsEventTypeForTemplate(type: SmsTemplateType): string {
  return type;
}

export const SMS_TEMPLATE_TYPES: ReadonlySet<SmsTemplateType> = new Set([
  "PHONE_VERIFICATION",
  "ORDER_RECEIVED",
  "ORDER_PREPARING",
  "ORDER_READY",
  "ORDER_CANCELLED",
  "ORDER_ISSUE",
]);

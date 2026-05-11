/**
 * SMS notifications via Twilio. Primary channel for order updates.
 */
import { env } from "@/lib/env";
import { twilioClient, twilioPhoneNumber } from "@/lib/twilio";

function publicOrderBaseUrl(): string {
  return env.PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://mennyu.com";
}

export async function sendSms(to: string, body: string): Promise<{ success: boolean; error?: string }> {
  if (!twilioClient || !twilioPhoneNumber) {
    console.warn("Twilio not configured; skipping SMS");
    return { success: false, error: "Twilio not configured" };
  }
  const normalized = to.replace(/\D/g, "");
  const toE164 = normalized.length === 10 ? `+1${normalized}` : `+${normalized}`;
  try {
    await twilioClient.messages.create({
      body,
      from: twilioPhoneNumber,
      to: toE164,
    });
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, error: message };
  }
}

export async function sendOrderConfirmation(
  phone: string,
  orderId: string,
  totalCents: number,
  pickupFragment?: string
): Promise<void> {
  const total = (totalCents / 100).toFixed(2);
  const pickup = pickupFragment ? ` ${pickupFragment}.` : "";
  await sendSms(
    phone,
    `Your order with Open Order is confirmed. Order #${orderId.slice(-8).toUpperCase()}.${pickup} Total $${total}. Track status: ${publicOrderBaseUrl()}/order/${orderId}`
  );
}

export async function sendOrderStatusUpdate(
  phone: string,
  orderId: string,
  statusLabel: string
): Promise<void> {
  await sendSms(
    phone,
    `Open Order #${orderId.slice(-8).toUpperCase()}: ${statusLabel}. Details: ${publicOrderBaseUrl()}/order/${orderId}`
  );
}

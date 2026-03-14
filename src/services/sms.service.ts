/**
 * SMS notifications via Twilio. Primary channel for order updates.
 */
import { twilioClient, twilioPhoneNumber } from "@/lib/twilio";

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

export async function sendOrderConfirmation(phone: string, orderId: string, totalCents: number): Promise<void> {
  const total = (totalCents / 100).toFixed(2);
  await sendSms(
    phone,
    `Your Mennyu order is confirmed. Order #${orderId.slice(-8).toUpperCase()}. Total $${total}. Track status: https://mennyu.com/order/${orderId}`
  );
}

export async function sendOrderStatusUpdate(
  phone: string,
  orderId: string,
  statusLabel: string
): Promise<void> {
  await sendSms(
    phone,
    `Mennyu order #${orderId.slice(-8).toUpperCase()}: ${statusLabel}. Details: https://mennyu.com/order/${orderId}`
  );
}

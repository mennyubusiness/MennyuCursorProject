/**
 * HTTP client for Deliverect API (sandbox-ready).
 * Transport only: no payload building. Replace with actual Deliverect auth (e.g. OAuth) and endpoints per their docs.
 * Caller persists payload and raw response for audit.
 */
import { env } from "@/lib/env";
import type { DeliverectOrderRequest, DeliverectOrderResponse } from "./payloads";

const BASE_URL = env.DELIVERECT_API_URL ?? "https://api.deliverect.com";

export async function submitOrder(
  payload: DeliverectOrderRequest
): Promise<{ success: boolean; externalOrderId?: string; error?: string; raw?: unknown }> {
  const url = `${BASE_URL}/orders`;
  const body = JSON.stringify(payload);
  const auth =
    env.DELIVERECT_CLIENT_ID && env.DELIVERECT_CLIENT_SECRET
      ? Buffer.from(`${env.DELIVERECT_CLIENT_ID}:${env.DELIVERECT_CLIENT_SECRET}`).toString("base64")
      : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(auth ? { Authorization: `Basic ${auth}` } : {}),
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body,
    });
    const raw = (await res.json().catch(() => ({}))) as DeliverectOrderResponse & { id?: string };
    if (!res.ok) {
      return {
        success: false,
        error: raw.error ?? res.statusText,
        raw,
      };
    }
    return {
      success: true,
      externalOrderId: raw.id,
      raw,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, error: message };
  }
}

/**
 * Deliverect Channel Registration handshake: response body must list webhook URLs Deliverect will call
 * for this integration (see https://developers.deliverect.com/reference/channel-registration).
 *
 * Field names match Deliverect’s documented JSON (camelCase). Optional URLs may be omitted; we include
 * stubs where we expose a verified endpoint that currently acknowledges but does not implement business logic.
 */
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";

/** Keys Deliverect documents on the registration response (subset may be required per channel type). */
export type DeliverectChannelRegistrationResponseBody = {
  statusUpdateURL: string;
  menuUpdateURL: string;
  snoozeUnsnoozeURL: string;
  busyModeURL: string;
  /** Optional in Deliverect docs — included when we expose a stub route. */
  updatePrepTimeURL?: string;
  courierUpdateURL?: string;
  paymentUpdateURL?: string;
  /** Merchant / storefront URL (informational). */
  menuUrl?: string;
};

/**
 * Resolves the public https origin for absolute webhook URLs.
 * Prefer PUBLIC_APP_URL / NEXTAUTH_URL so behavior is stable behind proxies.
 */
export function resolveDeliverectPublicOrigin(request: NextRequest): string {
  const fromEnv = env.PUBLIC_APP_URL?.trim() || env.NEXTAUTH_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = (request.headers.get("x-forwarded-proto") ?? "https").split(",")[0]?.trim() || "https";
  if (host) {
    return `${proto}://${host.replace(/\/$/, "")}`;
  }
  return request.nextUrl.origin.replace(/\/$/, "");
}

/**
 * Builds the JSON object Deliverect expects after a successful channel registration POST.
 * Paths align with existing Mennyu routes under `/api/webhooks/deliverect/*`.
 */
export function buildDeliverectChannelRegistrationResponseBody(origin: string): DeliverectChannelRegistrationResponseBody {
  const base = origin.replace(/\/$/, "");
  return {
    statusUpdateURL: `${base}/api/webhooks/deliverect`,
    menuUpdateURL: `${base}/api/webhooks/deliverect/menu`,
    snoozeUnsnoozeURL: `${base}/api/webhooks/deliverect/snooze`,
    busyModeURL: `${base}/api/webhooks/deliverect/busy-mode`,
    updatePrepTimeURL: `${base}/api/webhooks/deliverect/prep-time`,
    courierUpdateURL: `${base}/api/webhooks/deliverect/courier`,
    paymentUpdateURL: `${base}/api/webhooks/deliverect/payment`,
    menuUrl: `${base}/`,
  };
}

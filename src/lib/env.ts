/**
 * Validated environment variables (Zod).
 * Server-only: do not import from client components or any module used in the client bundle.
 */
import "server-only";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  DELIVERECT_API_URL: z.string().url().optional(),
  /** Channel name for order API path (case-sensitive). e.g. staging path: /{channelName}/order/{channelLinkId} */
  DELIVERECT_CHANNEL_NAME: z.string().optional(),
  DELIVERECT_TOKEN_URL: z.string().url().optional(),
  DELIVERECT_AUDIENCE: z.string().optional(),
  DELIVERECT_CLIENT_ID: z.string().optional(),
  DELIVERECT_CLIENT_SECRET: z.string().optional(),
  /** Optional static Bearer for Deliverect API (e.g. admin simulate). If unset, OAuth client credentials are used. */
  DELIVERECT_API_KEY: z.string().optional(),
  /**
   * Optional template for GET order by Deliverect order id (reconciliation fallback).
   * Placeholders: {baseUrl}, {orderId}. Default: "{baseUrl}/orders/{orderId}".
   */
  DELIVERECT_GET_ORDER_URL_TEMPLATE: z.string().optional(),
  DELIVERECT_WEBHOOK_SECRET: z.string().optional(),
  /**
   * Optional override for Deliverect webhook HMAC behavior.
   * `production` → verify with DELIVERECT_WEBHOOK_SECRET (partner secret).
   * Anything else (e.g. staging, sandbox) when set → verify with channelLinkId from webhook JSON.
   * If unset, NODE_ENV === "production" is treated as production.
   */
  DELIVERECT_ENV: z.string().optional(),
  /** When "mock", Deliverect submission is skipped (payload still built and audited). Use "deliverect" for live submission. */
  ROUTING_MODE: z.enum(["mock", "deliverect"]).default("mock"),
  NEXTAUTH_URL: z.string().url().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  /** Required in production for Auth.js (JWT session). Generate: openssl rand -base64 32 */
  AUTH_SECRET: z.string().min(32).optional(),
  /** Optional. When set, admin routes require this value (query param or cookie). TODO: Replace with proper auth. */
  ADMIN_SECRET: z.string().optional(),
  /**
   * Required in production for signed vendor dashboard magic links (`/api/vendor/.../session/grant`).
   * Min 32 characters; use a random secret (e.g. openssl rand -hex 32).
   */
  VENDOR_ACCESS_SIGNING_SECRET: z.string().min(32).optional(),
  /** Set to "true" to show Deliverect POS status simulation UI on admin order detail (production). */
  SHOW_DELIVERECT_STATUS_SIM_UI: z.enum(["true", "false"]).optional(),
  /** Verbose Deliverect HTTP / normalize logging (server). Keeps warnings for failures. */
  DEBUG_DELIVERECT: z.enum(["true", "false"]).optional(),
  /** IANA timezone when Pod.pickupTimezone is unset (scheduled pickup checkout & display). */
  DEFAULT_PICKUP_TIMEZONE: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid env:", parsed.error.flatten());
    throw new Error("Invalid environment variables");
  }
  return parsed.data;
}

export const env = loadEnv();

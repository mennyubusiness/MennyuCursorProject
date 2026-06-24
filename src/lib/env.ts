/**
 * Validated environment variables (Zod).
 * Server-only: do not import from client components or any module used in the client bundle.
 */
import "server-only";
import { z } from "zod";
import { assertProductionConfig } from "@/lib/production-config";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().optional(),
  /** ISO country code for new Stripe Connect Express accounts (default US). */
  STRIPE_CONNECT_ACCOUNT_COUNTRY: z.string().length(2).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  /**
   * Recommended Stripe Dashboard minimum platform balance (cents) for admin guidance.
   * Default 250000 ($2,500). Not applied via API — operators set this in Stripe Dashboard.
   */
  STRIPE_RECOMMENDED_PLATFORM_MINIMUM_BALANCE_CENTS: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  /** E.164 sender, e.g. +15551234567 (preferred name). */
  TWILIO_FROM_PHONE_NUMBER: z.string().optional(),
  /** Legacy alias for TWILIO_FROM_PHONE_NUMBER. */
  TWILIO_PHONE_NUMBER: z.string().optional(),
  /** When set, sends via Messaging Service (required for SMS_MODE=twilio). */
  TWILIO_MESSAGING_SERVICE_SID: z.string().optional(),
  /** Optional override for outbound SMS delivery status callbacks. */
  TWILIO_STATUS_CALLBACK_URL: z.string().url().optional(),
  /**
   * Primary SMS control: `log` (record only), `twilio` (live send), `disabled`.
   * Legacy SMS_ENABLED / SMS_DRY_RUN / SMS_LOG_ONLY still supported when unset.
   */
  SMS_MODE: z.enum(["log", "twilio", "disabled"]).optional(),
  /** Master switch for outbound SMS. Default: off in dev, on in production. */
  SMS_ENABLED: z.enum(["true", "false"]).optional(),
  /** When true, log/record SMS but do not call Twilio. Default: on outside production. */
  SMS_DRY_RUN: z.enum(["true", "false"]).optional(),
  /** When true, write SmsMessageLog only (no Twilio). */
  SMS_LOG_ONLY: z.enum(["true", "false"]).optional(),
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
   * Deliverect webhook HMAC verification mode.
   * `channel_link` (default): HMAC key is channelLinkId from payload, gated by Vendor.deliverectChannelLinkId lookup.
   * `partner_secret`: legacy global DELIVERECT_WEBHOOK_SECRET.
   */
  DELIVERECT_WEBHOOK_AUTH_MODE: z.enum(["channel_link", "partner_secret"]).default("channel_link"),
  /**
   * Deliverect environment label for API/routing (not the HMAC auth mode).
   * Set `staging` for sandbox on production hosts with ALLOW_DELIVERECT_STAGING_WEBHOOKS=true.
   */
  DELIVERECT_ENV: z.string().optional(),
  /** When "mock", Deliverect submission is skipped (payload still built and audited). Use "deliverect" for live submission. */
  ROUTING_MODE: z.enum(["mock", "deliverect"]).default("mock"),
  NEXTAUTH_URL: z.string().url().optional(),
  /**
   * Public https origin for this deployment (no trailing slash), e.g. https://app.openorder.co
   * Used for payment redirects, SMS links, and Twilio webhooks. Falls back to NEXTAUTH_URL.
   */
  PUBLIC_APP_URL: z.string().url().optional(),
  /** Client-readable public origin (optional; server prefers PUBLIC_APP_URL). */
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  /** Min 32 characters; preferred secret for signed customer order status links. Falls back to AUTH_SECRET. */
  ORDER_ACCESS_SIGNING_SECRET: z.string().min(32).optional(),
  /** Required in production for Auth.js (JWT session). Generate: openssl rand -base64 32 */
  AUTH_SECRET: z.string().min(32).optional(),
  /** Optional. When set, admin routes require this value (query param or cookie). TODO: Replace with proper auth. */
  ADMIN_SECRET: z.string().optional(),
  /** Bearer or query secret for internal cron/job routes (e.g. Deliverect auto reconciliation). */
  INTERNAL_JOB_SECRET: z.string().optional(),
  /**
   * Vercel Cron may send `Authorization: Bearer <CRON_SECRET>` automatically when this is set
   * in the Vercel project. Use the same value as INTERNAL_JOB_SECRET or set only one of them.
   */
  CRON_SECRET: z.string().optional(),
  /**
   * Required in production for signed vendor dashboard magic links (`/api/vendor/.../session/grant`).
   * Min 32 characters; use a random secret (e.g. openssl rand -hex 32).
   */
  VENDOR_ACCESS_SIGNING_SECRET: z.string().min(32).optional(),
  /** Set to "true" to show Deliverect POS status simulation UI on admin order detail (production). */
  SHOW_DELIVERECT_STATUS_SIM_UI: z.enum(["true", "false"]).optional(),
  /** When "true", enables admin QA tools (e.g. simulate routing failure) in production. */
  ENABLE_ADMIN_TEST_TOOLS: z.enum(["true", "false"]).optional(),
  /**
   * When "true", allows ROUTING_MODE=mock while NODE_ENV=production (orders do not reach POS).
   * Use only for staging/demo; not for live launch.
   */
  ALLOW_ROUTING_MODE_MOCK: z.enum(["true", "false"]).optional(),
  /**
   * When "true", allows DELIVERECT_ENV=staging (channel-link HMAC) while NODE_ENV=production.
   * For Deliverect sandbox on preview hosts only — not for live partner webhooks.
   */
  ALLOW_DELIVERECT_STAGING_WEBHOOKS: z.enum(["true", "false"]).optional(),
  /** Verbose Deliverect HTTP / normalize logging (server). Keeps warnings for failures. */
  DEBUG_DELIVERECT: z.enum(["true", "false"]).optional(),
  /** Verbose add-to-cart trace logs (server). Off in production; dev/test only when "true". */
  DEBUG_ADD_TO_CART_TRACE: z.enum(["true", "false"]).optional(),
  /**
   * When "true", enables legacy POST/PATCH/DELETE on /api/cart. Default off — use cart.actions.
   */
  ENABLE_CART_API_MUTATIONS: z.enum(["true", "false"]).optional(),
  /** IANA timezone when Pod.pickupTimezone is unset (scheduled pickup checkout & display). */
  DEFAULT_PICKUP_TIMEZONE: z.string().optional(),
  /** Supabase project URL (public). Used for Storage public URLs and optional admin client. */
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  /** Service role key — server-only; never expose to the client. Required for logo uploads to Storage. */
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  /** Storage bucket for brand logos (public). Default: mennyu-assets. Create in Supabase Dashboard → Storage. */
  SUPABASE_STORAGE_BUCKET: z.string().optional(),
  /** Master switch for outbound email (password recovery). Default: on in production. */
  EMAIL_ENABLED: z.enum(["true", "false"]).optional(),
  /** When true, log email content but do not call provider. Default: on outside production. */
  EMAIL_DRY_RUN: z.enum(["true", "false"]).optional(),
  /** When true, log only (no provider). */
  EMAIL_LOG_ONLY: z.enum(["true", "false"]).optional(),
  /** Resend API key for transactional email (password recovery). */
  RESEND_API_KEY: z.string().optional(),
  /** From address for transactional email, e.g. Open Order <noreply@yourdomain.com> */
  EMAIL_FROM: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid env:", parsed.error.flatten());
    throw new Error("Invalid environment variables");
  }
  const data = parsed.data;
  assertProductionConfig(data);
  return data;
}

export const env = loadEnv();

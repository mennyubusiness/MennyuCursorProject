/**
 * Production environment guards — fail closed on launch misconfiguration.
 * Skipped during local dev, Vitest, and `next build` (env may be incomplete in CI).
 */
import "server-only";

import type { Env } from "@/lib/env";

export function isNextCompileBuild(): boolean {
  return (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.NEXT_PHASE === "phase-development-build" ||
    (process.env.NODE_ENV === "production" && process.env.npm_lifecycle_event === "build")
  );
}

export function shouldValidateProductionConfig(nodeEnv: Env["NODE_ENV"]): boolean {
  return nodeEnv === "production" && !isNextCompileBuild();
}

function parseTriState(value: string | undefined): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function stripeKeyMode(key: string | undefined): "live" | "test" | "unknown" {
  const trimmed = key?.trim() ?? "";
  if (trimmed.startsWith("sk_live_") || trimmed.startsWith("pk_live_")) return "live";
  if (trimmed.startsWith("sk_test_") || trimmed.startsWith("pk_test_")) return "test";
  return "unknown";
}

/** Mirrors webhook-inbound-shared without importing env (avoids circular load). */
export function isDeliverectWebhookProductionMode(env: Pick<Env, "NODE_ENV" | "DELIVERECT_ENV">): boolean {
  const d = env.DELIVERECT_ENV?.trim();
  if (d !== undefined && d !== "") {
    return d.toLowerCase() === "production";
  }
  return env.NODE_ENV === "production";
}

function twilioFromPhoneNumber(env: Env): string | null {
  return env.TWILIO_FROM_PHONE_NUMBER ?? env.TWILIO_PHONE_NUMBER ?? null;
}

function hasTwilioCredentials(env: Env): boolean {
  return Boolean(
    env.TWILIO_ACCOUNT_SID?.trim() &&
      env.TWILIO_AUTH_TOKEN?.trim() &&
      (twilioFromPhoneNumber(env)?.trim() || env.TWILIO_MESSAGING_SERVICE_SID?.trim())
  );
}

function isSmsEnabledInProduction(env: Env): boolean {
  const explicit = parseTriState(env.SMS_ENABLED);
  return explicit ?? true;
}

function isSmsDryRun(env: Env): boolean {
  const explicit = parseTriState(env.SMS_DRY_RUN);
  return explicit ?? false;
}

function isSmsLogOnly(env: Env): boolean {
  return parseTriState(env.SMS_LOG_ONLY) === true;
}

function hasOrderAccessSigningSecret(env: Env): boolean {
  const dedicated = env.ORDER_ACCESS_SIGNING_SECRET?.trim();
  if (dedicated && dedicated.length >= 32) return true;
  const authSecret = env.AUTH_SECRET?.trim();
  return Boolean(authSecret && authSecret.length >= 32);
}

function hasPublicAppOrigin(env: Env): boolean {
  return Boolean(env.PUBLIC_APP_URL?.trim() || env.NEXTAUTH_URL?.trim());
}

export type ProductionConfigValidation = {
  errors: string[];
  warnings: string[];
};

/**
 * Collect production misconfiguration errors and non-fatal warnings.
 * Callers may use this in tests without throwing.
 */
export function validateProductionConfig(env: Env): ProductionConfigValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!shouldValidateProductionConfig(env.NODE_ENV)) {
    return { errors, warnings };
  }

  const deliverectWebhookProduction = isDeliverectWebhookProductionMode(env);
  const deliverectEnv = env.DELIVERECT_ENV?.trim().toLowerCase();
  const allowStagingWebhooks = parseTriState(env.ALLOW_DELIVERECT_STAGING_WEBHOOKS) === true;
  const allowMockRouting = parseTriState(env.ALLOW_ROUTING_MODE_MOCK) === true;

  // --- Deliverect ---
  if (env.ROUTING_MODE === "deliverect") {
    if (deliverectEnv !== "production") {
      errors.push(
        "ROUTING_MODE=deliverect requires DELIVERECT_ENV=production for live POS routing and partner webhook verification."
      );
    }
    if (!env.DELIVERECT_WEBHOOK_SECRET?.trim()) {
      errors.push("DELIVERECT_WEBHOOK_SECRET is required when ROUTING_MODE=deliverect.");
    }
  }

  if (
    env.NODE_ENV === "production" &&
    deliverectEnv &&
    deliverectEnv !== "production" &&
    !allowStagingWebhooks
  ) {
    errors.push(
      "DELIVERECT_ENV is not production while NODE_ENV=production (channel-link HMAC fallback would be used). " +
        "Set DELIVERECT_ENV=production for live webhooks, or ALLOW_DELIVERECT_STAGING_WEBHOOKS=true for intentional sandbox/preview."
    );
  }

  if (deliverectWebhookProduction && !env.DELIVERECT_WEBHOOK_SECRET?.trim()) {
    errors.push(
      "DELIVERECT_WEBHOOK_SECRET is required when Deliverect webhooks use production partner-secret verification."
    );
  }

  // --- Routing mode ---
  if (env.ROUTING_MODE === "mock" && !allowMockRouting) {
    errors.push(
      "ROUTING_MODE=mock is not allowed in production unless ALLOW_ROUTING_MODE_MOCK=true (orders will not reach POS)."
    );
  }

  // --- Stripe ---
  if (!env.STRIPE_SECRET_KEY?.trim()) {
    errors.push("STRIPE_SECRET_KEY is required in production.");
  }
  if (!env.STRIPE_WEBHOOK_SECRET?.trim()) {
    errors.push("STRIPE_WEBHOOK_SECRET is required in production.");
  }
  if (!hasPublicAppOrigin(env)) {
    errors.push("PUBLIC_APP_URL or NEXTAUTH_URL is required in production for payment redirects and SMS links.");
  }

  const secretMode = stripeKeyMode(env.STRIPE_SECRET_KEY);
  const publishableMode = stripeKeyMode(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  if (
    secretMode !== "unknown" &&
    publishableMode !== "unknown" &&
    secretMode !== publishableMode
  ) {
    warnings.push(
      `Stripe key mode mismatch: secret is ${secretMode}, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is ${publishableMode}.`
    );
  }
  if (secretMode === "test") {
    warnings.push("STRIPE_SECRET_KEY appears to be a test key in production.");
  }

  // --- SMS / Twilio ---
  if (isSmsEnabledInProduction(env) && !isSmsDryRun(env) && !isSmsLogOnly(env)) {
    if (!hasTwilioCredentials(env)) {
      errors.push(
        "SMS_ENABLED with live send (SMS_DRY_RUN=false) requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_PHONE_NUMBER or TWILIO_MESSAGING_SERVICE_SID."
      );
    }
  }

  // --- Order access signing ---
  if (!hasOrderAccessSigningSecret(env)) {
    errors.push(
      "ORDER_ACCESS_SIGNING_SECRET or AUTH_SECRET (min 32 characters) is required in production for signed order links."
    );
  }

  // --- Auth ---
  if (!env.AUTH_SECRET?.trim() || env.AUTH_SECRET.trim().length < 32) {
    errors.push("AUTH_SECRET (min 32 characters) is required in production for customer/vendor sessions.");
  }

  if (!env.VENDOR_ACCESS_SIGNING_SECRET?.trim() || env.VENDOR_ACCESS_SIGNING_SECRET.trim().length < 32) {
    errors.push(
      "VENDOR_ACCESS_SIGNING_SECRET (min 32 characters) is required in production for vendor dashboard magic links."
    );
  }

  // --- Admin bridge (warn only; platform admin session is preferred) ---
  if (!env.ADMIN_SECRET?.trim()) {
    warnings.push(
      "ADMIN_SECRET is unset: admin secret bridge and platform-admin bootstrap are unavailable. Prefer platform admin User session (see docs/PLATFORM_ADMIN.md)."
    );
  }

  // --- Internal jobs / cron ---
  if (!env.INTERNAL_JOB_SECRET?.trim() && !env.CRON_SECRET?.trim()) {
    warnings.push(
      "INTERNAL_JOB_SECRET and CRON_SECRET are unset: /api/internal/jobs/* endpoints return 503 until one is configured."
    );
  }

  return { errors, warnings };
}

export function assertProductionConfig(env: Env): void {
  const { errors, warnings } = validateProductionConfig(env);
  for (const warning of warnings) {
    console.warn(`[production-config] ${warning}`);
  }
  if (errors.length === 0) return;

  console.error(
    "[production-config] Invalid production configuration:\n" +
      errors.map((error) => `  - ${error}`).join("\n")
  );
  throw new Error(`Invalid production configuration (${errors.length} error(s)). See server logs.`);
}

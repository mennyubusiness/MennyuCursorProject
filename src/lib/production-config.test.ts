import { describe, expect, it } from "vitest";

import type { Env } from "@/lib/env";
import {
  isDeliverectWebhookProductionMode,
  validateProductionConfig,
} from "@/lib/production-config";

function productionEnv(overrides: Partial<Env> = {}): Env {
  return {
    DATABASE_URL: "postgresql://u:p@localhost:5432/db",
    NODE_ENV: "production",
    ROUTING_MODE: "deliverect",
    DELIVERECT_ENV: "production",
    DELIVERECT_WEBHOOK_AUTH_MODE: "channel_link",
    STRIPE_SECRET_KEY: "sk_live_test_key_for_validation_only",
    STRIPE_WEBHOOK_SECRET: "whsec_test",
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_test",
    PUBLIC_APP_URL: "https://app.example.com",
    AUTH_SECRET: "production-auth-secret-min-32-chars!!",
    ORDER_ACCESS_SIGNING_SECRET: "production-order-access-signing-secret-32",
    VENDOR_ACCESS_SIGNING_SECRET: "production-vendor-access-signing-secret-32",
    SMS_ENABLED: "false",
    SMS_DRY_RUN: "true",
    EMAIL_DRY_RUN: "true",
    ...overrides,
  } as Env;
}

describe("validateProductionConfig", () => {
  it("passes with a minimal valid production launch config", () => {
    const result = validateProductionConfig(productionEnv());
    expect(result.errors).toEqual([]);
  });

  it("skips validation outside production runtime", () => {
    const result = validateProductionConfig(
      productionEnv({ NODE_ENV: "development", ROUTING_MODE: "mock" })
    );
    expect(result.errors).toEqual([]);
  });

  it("rejects ROUTING_MODE=mock without override", () => {
    const result = validateProductionConfig(productionEnv({ ROUTING_MODE: "mock" }));
    expect(result.errors.some((e) => e.includes("ROUTING_MODE=mock"))).toBe(true);
  });

  it("allows ROUTING_MODE=mock when explicitly overridden", () => {
    const result = validateProductionConfig(
      productionEnv({
        ROUTING_MODE: "mock",
        ALLOW_ROUTING_MODE_MOCK: "true",
      })
    );
    expect(result.errors.filter((e) => e.includes("ROUTING_MODE=mock"))).toEqual([]);
  });

  it("allows ROUTING_MODE=deliverect with channel_link auth without DELIVERECT_WEBHOOK_SECRET", () => {
    const result = validateProductionConfig(
      productionEnv({
        DELIVERECT_WEBHOOK_AUTH_MODE: "channel_link",
        DELIVERECT_WEBHOOK_SECRET: undefined,
      })
    );
    expect(result.errors.filter((e) => e.includes("DELIVERECT_WEBHOOK_SECRET"))).toEqual([]);
  });

  it("allows staging Deliverect on production host when explicitly overridden", () => {
    const result = validateProductionConfig(
      productionEnv({
        DELIVERECT_ENV: "staging",
        ALLOW_DELIVERECT_STAGING_WEBHOOKS: "true",
      })
    );
    expect(result.errors.filter((e) => e.includes("DELIVERECT_ENV"))).toEqual([]);
  });

  it("requires DELIVERECT_ENV when ROUTING_MODE=deliverect", () => {
    const result = validateProductionConfig(productionEnv({ DELIVERECT_ENV: undefined }));
    expect(result.errors.some((e) => e.includes("DELIVERECT_ENV"))).toBe(true);
  });

  it("requires DELIVERECT_WEBHOOK_SECRET when partner_secret auth mode is enabled", () => {
    const result = validateProductionConfig(
      productionEnv({
        DELIVERECT_WEBHOOK_AUTH_MODE: "partner_secret",
        DELIVERECT_WEBHOOK_SECRET: undefined,
      })
    );
    expect(result.errors.some((e) => e.includes("DELIVERECT_WEBHOOK_SECRET"))).toBe(true);
  });

  it("rejects staging Deliverect on production NODE_ENV without override", () => {
    const result = validateProductionConfig(
      productionEnv({
        ROUTING_MODE: "mock",
        ALLOW_ROUTING_MODE_MOCK: "true",
        DELIVERECT_ENV: "staging",
      })
    );
    expect(result.errors.some((e) => e.includes("DELIVERECT_ENV is not production"))).toBe(true);
  });

  it("requires Stripe keys and public app URL", () => {
    const result = validateProductionConfig(
      productionEnv({
        STRIPE_SECRET_KEY: undefined,
        STRIPE_WEBHOOK_SECRET: undefined,
        PUBLIC_APP_URL: undefined,
        NEXTAUTH_URL: undefined,
      })
    );
    expect(result.errors.some((e) => e.includes("STRIPE_SECRET_KEY"))).toBe(true);
    expect(result.errors.some((e) => e.includes("STRIPE_WEBHOOK_SECRET"))).toBe(true);
    expect(result.errors.some((e) => e.includes("PUBLIC_APP_URL"))).toBe(true);
  });

  it("requires Twilio credentials when SMS live send is enabled", () => {
    const result = validateProductionConfig(
      productionEnv({
        SMS_ENABLED: "true",
        SMS_DRY_RUN: "false",
        TWILIO_ACCOUNT_SID: undefined,
      })
    );
    expect(result.errors.some((e) => e.includes("TWILIO"))).toBe(true);
  });

  it("allows SMS dry-run without Twilio credentials", () => {
    const result = validateProductionConfig(
      productionEnv({
        SMS_ENABLED: "true",
        SMS_DRY_RUN: "true",
        TWILIO_ACCOUNT_SID: undefined,
      })
    );
    expect(result.errors.filter((e) => e.includes("TWILIO"))).toEqual([]);
  });

  it("requires Resend credentials when email live send is enabled", () => {
    const result = validateProductionConfig(
      productionEnv({
        EMAIL_ENABLED: "true",
        EMAIL_DRY_RUN: "false",
        RESEND_API_KEY: undefined,
        EMAIL_FROM: undefined,
      })
    );
    expect(result.errors.some((e) => e.includes("RESEND_API_KEY"))).toBe(true);
  });

  it("allows email dry-run without Resend credentials", () => {
    const result = validateProductionConfig(
      productionEnv({
        EMAIL_ENABLED: "true",
        EMAIL_DRY_RUN: "true",
        RESEND_API_KEY: undefined,
      })
    );
    expect(result.errors.filter((e) => e.includes("RESEND_API_KEY"))).toEqual([]);
  });

  it("warns on Stripe live/test publishable mismatch", () => {
    const result = validateProductionConfig(
      productionEnv({
        STRIPE_SECRET_KEY: "sk_live_abc",
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_abc",
      })
    );
    expect(result.warnings.some((w) => w.includes("Stripe key mode mismatch"))).toBe(true);
  });
});

describe("isDeliverectWebhookProductionMode", () => {
  it("uses DELIVERECT_ENV when set", () => {
    expect(
      isDeliverectWebhookProductionMode({
        NODE_ENV: "production",
        DELIVERECT_ENV: "staging",
      })
    ).toBe(false);
    expect(
      isDeliverectWebhookProductionMode({
        NODE_ENV: "development",
        DELIVERECT_ENV: "production",
      })
    ).toBe(true);
  });
});

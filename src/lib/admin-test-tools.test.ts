import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockAuth = vi.fn();

const envState = vi.hoisted(() => ({
  NODE_ENV: "production" as string,
  ENABLE_ADMIN_TEST_TOOLS: undefined as string | undefined,
}));

vi.mock("@/lib/env", () => ({
  env: envState,
}));

vi.mock("@/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

import {
  assertAdminTestToolsApiAccess,
  canShowAdminTestToolsUi,
  isAdminTestToolsEnabled,
} from "./admin-test-tools";

describe("admin test tools gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envState.NODE_ENV = "production";
    envState.ENABLE_ADMIN_TEST_TOOLS = undefined;
    mockAuth.mockResolvedValue(null);
  });

  it("is disabled in production by default", () => {
    expect(isAdminTestToolsEnabled()).toBe(false);
  });

  it("can be enabled explicitly in production", () => {
    envState.ENABLE_ADMIN_TEST_TOOLS = "true";
    expect(isAdminTestToolsEnabled()).toBe(true);
  });

  it("is enabled in non-production environments", () => {
    envState.NODE_ENV = "development";
    expect(isAdminTestToolsEnabled()).toBe(true);
  });

  it("returns 404 for simulate routing failure API when disabled", async () => {
    const gate = await assertAdminTestToolsApiAccess();
    expect(gate).toEqual({
      ok: false,
      status: 404,
      error: "Not found",
      code: "DISABLED",
    });
  });

  it("returns 403 for non-platform-admin when tools enabled", async () => {
    envState.ENABLE_ADMIN_TEST_TOOLS = "true";
    mockAuth.mockResolvedValue({ user: { id: "user_customer", isPlatformAdmin: false } });

    const gate = await assertAdminTestToolsApiAccess();
    expect(gate).toEqual({
      ok: false,
      status: 403,
      error: "Platform admin required.",
      code: "FORBIDDEN",
    });
  });

  it("allows platform admin when tools enabled", async () => {
    envState.ENABLE_ADMIN_TEST_TOOLS = "true";
    mockAuth.mockResolvedValue({ user: { id: "user_admin", isPlatformAdmin: true } });

    await expect(assertAdminTestToolsApiAccess()).resolves.toEqual({ ok: true });
  });

  it("hides admin test tools UI for customers even when tools enabled", async () => {
    envState.ENABLE_ADMIN_TEST_TOOLS = "true";
    mockAuth.mockResolvedValue({ user: { id: "user_customer", isPlatformAdmin: false } });
    await expect(canShowAdminTestToolsUi()).resolves.toBe(false);
  });

  it("shows admin test tools UI only for platform admin", async () => {
    envState.ENABLE_ADMIN_TEST_TOOLS = "true";
    mockAuth.mockResolvedValue({ user: { id: "user_admin", isPlatformAdmin: true } });
    await expect(canShowAdminTestToolsUi()).resolves.toBe(true);
  });
});

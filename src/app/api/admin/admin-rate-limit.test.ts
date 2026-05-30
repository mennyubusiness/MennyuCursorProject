import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/env", () => ({
  env: {
    NODE_ENV: "production",
    ADMIN_SECRET: "test-admin-secret",
  },
}));

vi.mock("@/lib/admin-auth", () => ({
  buildAdminCookieHeader: (secret: string) => `mennyu_admin=${secret}; Path=/; HttpOnly`,
}));

import { resetRateLimitStoreForTests, RATE_LIMITS } from "@/lib/rate-limit";
import { POST as adminAccessPost } from "./access/route";
describe("POST /api/admin/access rate limit", () => {
  beforeEach(() => {
    process.env.RATE_LIMIT_TEST = "1";
    resetRateLimitStoreForTests();
  });

  afterEach(() => {
    delete process.env.RATE_LIMIT_TEST;
    resetRateLimitStoreForTests();
  });

  it("returns 429 after too many attempts from one IP", async () => {
    for (let i = 0; i < RATE_LIMITS.adminAccess.limit; i++) {
      const res = await adminAccessPost(
        new NextRequest("http://localhost/api/admin/access", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": "8.8.8.8",
          },
          body: JSON.stringify({ secret: "wrong" }),
        })
      );
      expect(res.status).toBe(403);
    }

    const limited = await adminAccessPost(
      new NextRequest("http://localhost/api/admin/access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "8.8.8.8",
        },
        body: JSON.stringify({ secret: "wrong" }),
      })
    );
    const body = await limited.json();
    expect(limited.status).toBe(429);
    expect(body.code).toBe("RATE_LIMITED");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockRevokeCustomerSessionFromRequest = vi.fn();

vi.mock("@/lib/customer-session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/customer-session")>();
  return {
    ...actual,
    revokeCustomerSessionFromRequest: (...args: unknown[]) =>
      mockRevokeCustomerSessionFromRequest(...args),
  };
});

import { CUSTOMER_SESSION_COOKIE, buildClearCustomerSessionCookieHeader } from "@/lib/customer-session";
import { POST } from "./route";

describe("POST /api/customer/session/clear", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRevokeCustomerSessionFromRequest.mockResolvedValue(undefined);
  });

  it("revokes session and clears cookie when cookie is present", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/customer/session/clear", {
        method: "POST",
        headers: {
          cookie: `${CUSTOMER_SESSION_COOKIE}=${encodeURIComponent("token_abc")}`,
        },
      })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockRevokeCustomerSessionFromRequest).toHaveBeenCalledTimes(1);
    expect(res.headers.get("Set-Cookie")).toContain(`${CUSTOMER_SESSION_COOKIE}=`);
    expect(res.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });

  it("succeeds idempotently when no cookie is present", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/customer/session/clear", { method: "POST" })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockRevokeCustomerSessionFromRequest).toHaveBeenCalledTimes(1);
    expect(res.headers.get("Set-Cookie")).toBe(buildClearCustomerSessionCookieHeader());
  });

  it("still clears cookie when revoke is a no-op for stale token", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/customer/session/clear", {
        method: "POST",
        headers: {
          cookie: `${CUSTOMER_SESSION_COOKIE}=stale-token`,
        },
      })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

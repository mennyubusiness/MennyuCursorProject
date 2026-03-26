import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  COOKIE_NAME,
  SESSION_HEADER,
  getOrSetSessionId,
  getSessionIdFromHeaders,
  getSessionIdFromRequest,
} from "./session";

describe("getSessionIdFromRequest", () => {
  it("prefers cookie over header", () => {
    const req = new NextRequest("http://localhost/api/cart", {
      headers: {
        cookie: `${COOKIE_NAME}=from-cookie`,
        [SESSION_HEADER]: "from-header",
      },
    });
    expect(getSessionIdFromRequest(req)).toBe("from-cookie");
  });

  it("reads x-mennyu-session when cookie absent (middleware echo)", () => {
    const req = new NextRequest("http://localhost/api/cart", {
      headers: { [SESSION_HEADER]: "middleware-id" },
    });
    expect(getSessionIdFromRequest(req)).toBe("middleware-id");
  });

  it("returns null when neither cookie nor header", () => {
    const req = new NextRequest("http://localhost/api/cart");
    expect(getSessionIdFromRequest(req)).toBeNull();
  });
});

describe("getSessionIdFromHeaders (RSC / Actions parity)", () => {
  it("reads mennyu_session from Cookie header string", () => {
    const h = new Headers({
      cookie: `${COOKIE_NAME}=${encodeURIComponent("from-cookie-string")}`,
    });
    expect(getSessionIdFromHeaders(h)).toBe("from-cookie-string");
  });

  it("uses x-mennyu-session when cookie name absent", () => {
    const h = new Headers({ [SESSION_HEADER]: "echo" });
    expect(getSessionIdFromHeaders(h)).toBe("echo");
  });

  it("prefers cookie string over x-mennyu-session", () => {
    const h = new Headers({
      cookie: `${COOKIE_NAME}=cookie-wins`,
      [SESSION_HEADER]: "header-loses",
    });
    expect(getSessionIdFromHeaders(h)).toBe("cookie-wins");
  });
});

describe("getOrSetSessionId", () => {
  it("reuses session from header without minting", () => {
    const req = new NextRequest("http://localhost/api/cart", {
      headers: { [SESSION_HEADER]: "stable-id" },
    });
    const r = getOrSetSessionId(req);
    expect(r.sessionId).toBe("stable-id");
    expect(r.isNew).toBe(false);
  });

  it("mints new id only when no cookie and no header", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("new-uuid");
    try {
      const req = new NextRequest("http://localhost/api/cart");
      const r = getOrSetSessionId(req);
      expect(r.sessionId).toBe("new-uuid");
      expect(r.isNew).toBe(true);
    } finally {
      vi.restoreAllMocks();
    }
  });
});

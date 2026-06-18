import { describe, expect, it } from "vitest";
import {
  buildLoginHrefFromLocation,
  buildLoginHrefWithReturn,
  DEFAULT_CUSTOMER_POST_LOGIN_PATH,
  isAdminReturnPath,
  readLoginReturnParam,
  sanitizeLoginReturnPath,
} from "@/lib/auth/login-return-path";

describe("sanitizeLoginReturnPath", () => {
  it("allows safe internal paths with query", () => {
    expect(sanitizeLoginReturnPath("/cart")).toBe("/cart");
    expect(sanitizeLoginReturnPath("/pod/abc?vendor=burger")).toBe("/pod/abc?vendor=burger");
    expect(sanitizeLoginReturnPath("/pod/abc/vendor/v1")).toBe("/pod/abc/vendor/v1");
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(sanitizeLoginReturnPath("https://evil.com")).toBeNull();
    expect(sanitizeLoginReturnPath("//evil.com")).toBeNull();
    expect(sanitizeLoginReturnPath("evil.com")).toBeNull();
  });

  it("rejects /login to avoid redirect loops", () => {
    expect(sanitizeLoginReturnPath("/login")).toBeNull();
    expect(sanitizeLoginReturnPath("/login?next=/cart")).toBeNull();
    expect(sanitizeLoginReturnPath("/register")).toBeNull();
    expect(sanitizeLoginReturnPath("/auth/signout")).toBeNull();
  });
});

describe("buildLoginHrefWithReturn", () => {
  it("encodes next for cart and account", () => {
    expect(buildLoginHrefWithReturn("/cart")).toBe("/login?next=%2Fcart");
    expect(buildLoginHrefWithReturn("/account")).toBe("/login?next=%2Faccount");
  });
});

describe("buildLoginHrefFromLocation", () => {
  it("includes pathname and search from current location", () => {
    const href = buildLoginHrefFromLocation(
      "/pod/pod_1",
      new URLSearchParams("vendor=v1")
    );
    expect(href).toBe("/login?next=%2Fpod%2Fpod_1%3Fvendor%3Dv1");
  });

  it("omits next on auth-only routes", () => {
    expect(buildLoginHrefFromLocation("/login", null)).toBe("/login");
    expect(buildLoginHrefFromLocation("/register", null)).toBe("/login");
  });
});

describe("readLoginReturnParam", () => {
  it("prefers next over legacy callbackUrl", () => {
    const params = new URLSearchParams("next=%2Fcart&callbackUrl=%2Forders");
    expect(readLoginReturnParam(params)).toBe("/cart");
  });

  it("falls back to callbackUrl", () => {
    const params = new URLSearchParams("callbackUrl=%2Forders");
    expect(readLoginReturnParam(params)).toBe("/orders");
  });
});

describe("isAdminReturnPath", () => {
  it("detects admin paths", () => {
    expect(isAdminReturnPath("/admin")).toBe(true);
    expect(isAdminReturnPath("/admin/orders")).toBe(true);
    expect(isAdminReturnPath("/explore")).toBe(false);
  });
});

describe("defaults", () => {
  it("uses explore as customer default", () => {
    expect(DEFAULT_CUSTOMER_POST_LOGIN_PATH).toBe("/explore");
  });
});

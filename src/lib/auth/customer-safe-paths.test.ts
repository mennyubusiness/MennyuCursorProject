import { describe, expect, it } from "vitest";
import {
  getPostLogoutRedirect,
  isProtectedAuthPath,
  isPublicCustomerSafePath,
} from "@/lib/auth/customer-safe-paths";
import {
  DEFAULT_CUSTOMER_POST_LOGIN_PATH,
  sanitizeLoginReturnPath,
  SIGN_IN_PATH,
} from "@/lib/auth/login-return-path";

describe("isPublicCustomerSafePath", () => {
  it("allows marketplace and cart routes", () => {
    expect(isPublicCustomerSafePath("/explore")).toBe(true);
    expect(isPublicCustomerSafePath("/cart")).toBe(true);
    expect(isPublicCustomerSafePath("/checkout")).toBe(true);
    expect(isPublicCustomerSafePath("/pod/abc")).toBe(true);
    expect(isPublicCustomerSafePath("/pod/abc/vendor/xyz")).toBe(true);
    expect(isPublicCustomerSafePath("/")).toBe(true);
    expect(isPublicCustomerSafePath("/privacy")).toBe(true);
  });

  it("rejects protected operator routes", () => {
    expect(isPublicCustomerSafePath("/account")).toBe(false);
    expect(isPublicCustomerSafePath("/vendor/dashboard")).toBe(false);
    expect(isPublicCustomerSafePath("/pod/abc/dashboard")).toBe(false);
  });
});

describe("isProtectedAuthPath", () => {
  it("treats account and operator dashboards as protected", () => {
    expect(isProtectedAuthPath("/account")).toBe(true);
    expect(isProtectedAuthPath("/account/role")).toBe(true);
    expect(isProtectedAuthPath("/orders")).toBe(true);
    expect(isProtectedAuthPath("/vendor/dashboard")).toBe(true);
    expect(isProtectedAuthPath("/admin/analytics")).toBe(true);
    expect(isProtectedAuthPath("/pod/abc/settings")).toBe(true);
  });

  it("treats marketplace pages as public after logout", () => {
    expect(isProtectedAuthPath("/explore")).toBe(false);
    expect(isProtectedAuthPath("/pod/abc")).toBe(false);
    expect(isProtectedAuthPath("/pod/abc/vendor/xyz")).toBe(false);
  });
});

describe("getPostLogoutRedirect", () => {
  it("keeps user on public customer pages", () => {
    expect(getPostLogoutRedirect("/pod/abc")).toBe("/pod/abc");
    expect(getPostLogoutRedirect("/explore")).toBe("/explore");
    expect(getPostLogoutRedirect("/cart")).toBe("/cart");
  });

  it("preserves query strings on safe pages", () => {
    expect(getPostLogoutRedirect("/pod/abc?vendor=v1")).toBe("/pod/abc?vendor=v1");
  });

  it("redirects to sign-in from protected pages", () => {
    expect(getPostLogoutRedirect("/account")).toBe(SIGN_IN_PATH);
    expect(getPostLogoutRedirect("/vendor/dashboard")).toBe(SIGN_IN_PATH);
    expect(getPostLogoutRedirect("/admin/orders")).toBe(SIGN_IN_PATH);
    expect(getPostLogoutRedirect("/pod/abc/settings")).toBe(SIGN_IN_PATH);
  });

  it("redirects to sign-in for unsafe external targets", () => {
    expect(getPostLogoutRedirect("https://evil.com")).toBe(SIGN_IN_PATH);
    expect(getPostLogoutRedirect(null)).toBe(SIGN_IN_PATH);
  });
});

describe("login callback sanitization", () => {
  it("allows safe internal login callbacks", () => {
    expect(sanitizeLoginReturnPath("/pod/abc")).toBe("/pod/abc");
    expect(sanitizeLoginReturnPath("/explore")).toBe("/explore");
  });

  it("falls back when callback is missing or unsafe", () => {
    expect(sanitizeLoginReturnPath(null)).toBeNull();
    expect(sanitizeLoginReturnPath("https://evil.com")).toBeNull();
    expect(sanitizeLoginReturnPath("/login")).toBeNull();
    expect(sanitizeLoginReturnPath("/auth/signin")).toBeNull();
  });

  it("uses explore as customer default when callback is missing", () => {
    expect(DEFAULT_CUSTOMER_POST_LOGIN_PATH).toBe("/explore");
  });
});

import { describe, expect, it } from "vitest";
import {
  createCustomerOrderAccessToken,
  orderStatusUrlWithAccess,
  verifyCustomerOrderAccessToken,
} from "./customer-order-access-token";

describe("customer-order-access-token", () => {
  it("builds signed order status URLs for SMS links", () => {
    const url = orderStatusUrlWithAccess("ord_abc", "https://mennyu.com");
    expect(url).toMatch(/^https:\/\/mennyu\.com\/order\/ord_abc\?access=/);
    const token = new URL(url).searchParams.get("access");
    expect(token).toBeTruthy();
    expect(verifyCustomerOrderAccessToken("ord_abc", token!)).toBe(true);
  });

  it("rejects tampered tokens", () => {
    const token = createCustomerOrderAccessToken("ord_abc");
    const tilde = token.lastIndexOf("~");
    const payloadB64 = token.slice(0, tilde);
    const sig = token.slice(tilde + 1);
    const tampered = `${payloadB64}~${sig.slice(0, -1)}0`;
    expect(verifyCustomerOrderAccessToken("ord_abc", tampered)).toBe(false);
  });
});

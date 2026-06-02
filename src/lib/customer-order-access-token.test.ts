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
    const last = sig.at(-1)!;
    const flippedLast = last === "a" ? "b" : "a";
    const badSig = `${sig.slice(0, -1)}${flippedLast}`;
    expect(badSig).not.toBe(sig);
    expect(verifyCustomerOrderAccessToken("ord_abc", `${payloadB64}~${badSig}`)).toBe(false);

    const flippedPayloadChar = payloadB64.at(-1)! === "A" ? "B" : "A";
    const badPayload = payloadB64.slice(0, -1) + flippedPayloadChar;
    expect(badPayload).not.toBe(payloadB64);
    expect(verifyCustomerOrderAccessToken("ord_abc", `${badPayload}~${sig}`)).toBe(false);
  });
});

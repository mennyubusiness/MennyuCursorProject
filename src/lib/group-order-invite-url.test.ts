import { describe, expect, it } from "vitest";
import {
  buildGroupOrderJoinAbsoluteUrl,
  buildGroupOrderJoinPath,
  buildGroupOrderShareText,
} from "./group-order-invite-url";

describe("group-order-invite-url", () => {
  it("builds participant join path from code only", () => {
    expect(buildGroupOrderJoinPath("973253")).toBe("/group-order/join?code=973253");
    expect(buildGroupOrderJoinPath("42")).toBe("/group-order/join?code=000042");
  });

  it("does not include session id or joinToken in invite URL", () => {
    const path = buildGroupOrderJoinPath("123456");
    expect(path).not.toMatch(/session=/);
    expect(path).not.toMatch(/token/i);
  });

  it("builds absolute invite URL for sharing", () => {
    expect(buildGroupOrderJoinAbsoluteUrl("https://order.example.com", "973253")).toBe(
      "https://order.example.com/group-order/join?code=973253"
    );
  });

  it("builds share text with pod name and code", () => {
    expect(buildGroupOrderShareText("River Market", "973253")).toBe(
      "Join my Open Order group order at River Market. Code: 973253"
    );
  });
});

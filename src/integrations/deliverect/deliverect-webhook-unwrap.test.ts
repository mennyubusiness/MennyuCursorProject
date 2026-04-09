import { describe, expect, it } from "vitest";
import { unwrapDeliverectSingleObjectPayload } from "./deliverect-webhook-unwrap";

describe("unwrapDeliverectSingleObjectPayload", () => {
  it("passes through a plain object", () => {
    const r = unwrapDeliverectSingleObjectPayload({ a: 1 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.object).toEqual({ a: 1 });
  });

  it("unwraps single-element array", () => {
    const r = unwrapDeliverectSingleObjectPayload([{ channelLinkId: "x" }]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.object).toEqual({ channelLinkId: "x" });
  });

  it("rejects multi-element array", () => {
    const r = unwrapDeliverectSingleObjectPayload([{}, {}]);
    expect(r.ok).toBe(false);
  });
});

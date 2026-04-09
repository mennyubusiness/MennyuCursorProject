import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { verifyDeliverectSignature } from "@/integrations/deliverect/webhook-handler";
import {
  flattenChannelRegistrationPayload,
  formatChannelRegistrationNoMatchDetail,
  getDeliverectChannelRegistrationEventId,
  parseChannelRegistrationPayload,
  resolveSequentialVendorMatch,
  summarizeChannelRegistrationPayload,
} from "./deliverect-channel-registration.service";

describe("parseChannelRegistrationPayload", () => {
  it("extracts channel link id from top-level and nested channel", () => {
    const parsed = {
      channelLinkId: "ch-1",
      data: { locationId: "loc-9" },
    };
    const r = parseChannelRegistrationPayload(parsed);
    expect(r.channelLinkId).toBe("ch-1");
    expect(r.deliverectPortalLocationId).toBe("loc-9");
  });

  it("parses official Deliverect channel-registration request shape", () => {
    const parsed = {
      status: "active",
      channelLocationId: "external-or-mennyu-vendor-id",
      channelLinkId: "69d70c860cff69a10c787516",
      locationId: "portal-loc-1",
      channelLinkName: "Order Boss",
    };
    const r = parseChannelRegistrationPayload(parsed);
    expect(r.status).toBe("active");
    expect(r.channelLocationId).toBe("external-or-mennyu-vendor-id");
    expect(r.channelLinkId).toBe("69d70c860cff69a10c787516");
    expect(r.deliverectPortalLocationId).toBe("portal-loc-1");
    expect(r.channelLinkName).toBe("Order Boss");
    expect(r.email).toBeNull();
    expect(r.mennyuCorrelationKey).toBeNull();
  });

  it("reads mennyu correlation key from metadata", () => {
    const parsed = {
      channelLinkId: "cl-x",
      metadata: { mennyuCorrelationKey: "mk-abc" },
    };
    const r = parseChannelRegistrationPayload(parsed);
    expect(r.mennyuCorrelationKey).toBe("mk-abc");
    expect(r.channelLinkId).toBe("cl-x");
  });

  it("normalizes email to lowercase", () => {
    const parsed = {
      channelLinkId: "cl",
      email: "Owner@Restaurant.COM",
    };
    const r = parseChannelRegistrationPayload(parsed);
    expect(r.email).toBe("owner@restaurant.com");
  });
});

describe("flattenChannelRegistrationPayload", () => {
  it("merges nested account fields without throwing", () => {
    const parsed = {
      account: { id: "acc-1", email: "a@b.co" },
    };
    const flat = flattenChannelRegistrationPayload(parsed);
    expect(flat.email).toBe("a@b.co");
  });
});

describe("verifyDeliverectSignature (channel registration body)", () => {
  it("matches HMAC the same way as order/menu webhooks", () => {
    const body = JSON.stringify({ channelLinkId: "cl-test", webhookId: "reg-1" });
    const secret = "channel-secret-or-partner-secret";
    const sig = createHmac("sha256", secret).update(body, "utf8").digest("hex");
    expect(verifyDeliverectSignature(body, sig, secret, { nodeEnv: "production", allowUnsignedDev: false })).toBe(
      true
    );
    expect(verifyDeliverectSignature(body, sig, "wrong", { nodeEnv: "production", allowUnsignedDev: false })).toBe(
      false
    );
  });
});

describe("getDeliverectChannelRegistrationEventId", () => {
  it("uses webhook-style message ids when present", () => {
    const parsed = { webhookId: "w-99" };
    const flat = { ...parsed };
    const id = getDeliverectChannelRegistrationEventId(parsed, flat, "{}");
    expect(id).toBe("deliverect:chreg:msg:w-99");
  });
});

describe("formatChannelRegistrationNoMatchDetail", () => {
  it("includes payload keys and extracted ids", () => {
    const extract = parseChannelRegistrationPayload({
      status: "register",
      channelLinkId: "cl1",
      channelLocationId: "ext1",
      locationId: "loc1",
    });
    const s = summarizeChannelRegistrationPayload(
      { status: "register", channelLinkId: "cl1", channelLocationId: "ext1", locationId: "loc1" },
      extract
    );
    const d = formatChannelRegistrationNoMatchDetail(s);
    expect(d).toContain("no_match");
    expect(d).toContain("channelLinkId=cl1");
    expect(d).toContain("channelLocationId=ext1");
    expect(d).toContain("portalLocationId=loc1");
  });
});

describe("resolveSequentialVendorMatch", () => {
  it("prefers a single email match before key", () => {
    const r = resolveSequentialVendorMatch([{ id: "v1" }], [{ id: "v2" }], []);
    expect(r.kind).toBe("single");
    if (r.kind === "single") expect(r.vendorId).toBe("v1");
  });

  it("returns ambiguous when email matches multiple", () => {
    const r = resolveSequentialVendorMatch([{ id: "a" }, { id: "b" }], [], []);
    expect(r.kind).toBe("ambiguous");
    if (r.kind === "ambiguous") expect(r.vendorIds).toEqual(["a", "b"]);
  });

  it("falls through to correlation key when email empty", () => {
    const r = resolveSequentialVendorMatch([], [{ id: "k1" }], []);
    expect(r.kind).toBe("single");
    if (r.kind === "single") expect(r.vendorId).toBe("k1");
  });

  it("returns none when all empty", () => {
    expect(resolveSequentialVendorMatch([], [], []).kind).toBe("none");
  });
});

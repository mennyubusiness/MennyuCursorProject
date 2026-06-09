import { beforeEach, describe, expect, it, vi } from "vitest";

const mockParticipantFindFirst = vi.fn();
const mockSessionFindUnique = vi.fn();
const mockCartFindUnique = vi.fn();
const mockOrderFindFirst = vi.fn();
const mockResolveParticipant = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    groupOrderParticipant: {
      findFirst: (...args: unknown[]) => mockParticipantFindFirst(...args),
    },
    groupOrderSession: {
      findUnique: (...args: unknown[]) => mockSessionFindUnique(...args),
    },
    cart: {
      findUnique: (...args: unknown[]) => mockCartFindUnique(...args),
    },
    order: {
      findFirst: (...args: unknown[]) => mockOrderFindFirst(...args),
    },
  },
}));

vi.mock("@/lib/group-participant-order-access", () => ({
  findOrderIdForGroupOrderSession: vi.fn(async (sessionId: string) => {
    if (sessionId === "gos_1") return "ord_1";
    return null;
  }),
  resolveGroupParticipantForSession: (...args: unknown[]) => mockResolveParticipant(...args),
}));

vi.mock("@/services/cart.service", () => ({
  CART_DISPLAY_SESSION_CART_INCLUDE: {},
}));

describe("resolveSubmittedGroupOrderForParticipantCart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns submitted order id for valid participant cookie", async () => {
    mockParticipantFindFirst.mockResolvedValue({
      id: "part_1",
      groupOrderSessionId: "gos_1",
      groupOrderSession: {
        id: "gos_1",
        status: "submitted",
        cartId: "cart_1",
        podId: "pod_1",
      },
    });

    const { resolveSubmittedGroupOrderForParticipantCart } = await import(
      "./group-participant-submitted-cart"
    );
    const res = await resolveSubmittedGroupOrderForParticipantCart({
      participantId: "part_1",
      legacyJoinToken: null,
    });
    expect(res).toEqual({
      kind: "submitted",
      cartId: "cart_1",
      podId: "pod_1",
      groupOrderSessionId: "gos_1",
      participantId: "part_1",
      orderId: "ord_1",
    });
  });

  it("returns submitted without order when order not linked yet", async () => {
    mockParticipantFindFirst.mockResolvedValue({
      id: "part_1",
      groupOrderSessionId: "gos_2",
      groupOrderSession: {
        id: "gos_2",
        status: "submitted",
        cartId: "cart_1",
        podId: "pod_1",
      },
    });

    const { resolveSubmittedGroupOrderForParticipantCart } = await import(
      "./group-participant-submitted-cart"
    );
    const res = await resolveSubmittedGroupOrderForParticipantCart({
      participantId: "part_1",
      legacyJoinToken: null,
    });
    expect(res.kind).toBe("submitted");
    if (res.kind === "submitted") expect(res.orderId).toBeNull();
  });

  it("returns none without cookie", async () => {
    const { resolveSubmittedGroupOrderForParticipantCart } = await import(
      "./group-participant-submitted-cart"
    );
    const res = await resolveSubmittedGroupOrderForParticipantCart({
      participantId: null,
      legacyJoinToken: null,
    });
    expect(res).toEqual({ kind: "none" });
  });
});

describe("getGroupOrderSubmissionStatusForParticipantCart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveParticipant.mockResolvedValue({ id: "part_1", role: "participant" });
  });

  it("returns submitted order id only for participant actor", async () => {
    mockSessionFindUnique.mockResolvedValue({ id: "gos_1", status: "submitted" });

    const { getGroupOrderSubmissionStatusForParticipantCart } = await import(
      "./group-participant-submitted-cart"
    );
    const res = await getGroupOrderSubmissionStatusForParticipantCart({
      cartId: "cart_1",
      markers: { participantId: "part_1", legacyJoinToken: null },
    });
    expect(res).toEqual({
      ok: true,
      sessionStatus: "submitted",
      submittedOrderId: "ord_1",
    });
  });

  it("returns locked_checkout without order id", async () => {
    mockSessionFindUnique.mockResolvedValue({ id: "gos_1", status: "locked_checkout" });

    const { getGroupOrderSubmissionStatusForParticipantCart } = await import(
      "./group-participant-submitted-cart"
    );
    const res = await getGroupOrderSubmissionStatusForParticipantCart({
      cartId: "cart_1",
      markers: { participantId: "part_1", legacyJoinToken: null },
    });
    expect(res).toEqual({
      ok: true,
      sessionStatus: "locked_checkout",
      submittedOrderId: null,
    });
  });

  it("denies non-participant", async () => {
    mockSessionFindUnique.mockResolvedValue({ id: "gos_1", status: "submitted" });
    mockResolveParticipant.mockResolvedValue(null);

    const { getGroupOrderSubmissionStatusForParticipantCart } = await import(
      "./group-participant-submitted-cart"
    );
    const res = await getGroupOrderSubmissionStatusForParticipantCart({
      cartId: "cart_1",
      markers: { participantId: null, legacyJoinToken: null },
    });
    expect(res).toEqual({ ok: false, status: 403 });
  });
});

describe("cart page wiring", () => {
  it("uses server redirect and client submission poll", () => {
    const { readFileSync } = require("node:fs");
    const { join } = require("node:path");
    const cartPage = readFileSync(join(process.cwd(), "src/app/cart/page.tsx"), "utf8");
    const redirectClient = readFileSync(
      join(process.cwd(), "src/app/cart/GroupOrderSubmittedRedirect.tsx"),
      "utf8"
    );
    expect(cartPage).toMatch(/resolveSubmittedGroupOrderForParticipantCart/);
    expect(cartPage).toMatch(/GroupOrderSubmittedRedirect/);
    expect(cartPage).toMatch(/ParticipantSubmittedTrackingPage/);
    expect(redirectClient).toMatch(/router\.replace/);
    expect(redirectClient).toMatch(/group-order-submission-status/);
  });
});

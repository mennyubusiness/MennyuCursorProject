import { beforeEach, describe, expect, it, vi } from "vitest";

const mockOrderFindUnique = vi.fn();
const mockOrderFindFirst = vi.fn();
const mockSessionFindUnique = vi.fn();
const mockParticipantFindFirst = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    order: {
      findUnique: (...args: unknown[]) => mockOrderFindUnique(...args),
      findFirst: (...args: unknown[]) => mockOrderFindFirst(...args),
    },
    groupOrderSession: {
      findUnique: (...args: unknown[]) => mockSessionFindUnique(...args),
    },
    groupOrderParticipant: {
      findFirst: (...args: unknown[]) => mockParticipantFindFirst(...args),
    },
  },
}));

describe("group participant order access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("grants access for submitted order with matching participant cookie", async () => {
    mockOrderFindUnique.mockResolvedValue({
      id: "ord_1",
      customerPhone: "+15551230000",
      groupOrderSessionId: "gos_1",
    });
    mockSessionFindUnique.mockResolvedValue({ id: "gos_1", status: "submitted" });
    mockParticipantFindFirst.mockResolvedValue({
      id: "part_alex",
      role: "participant",
      displayName: "Alex",
      groupOrderSessionId: "gos_1",
      leftAt: null,
    });

    const { resolveGroupParticipantOrderAccess } = await import("./group-participant-order-access");
    const access = await resolveGroupParticipantOrderAccess({
      orderId: "ord_1",
      markers: { participantId: "part_alex", legacyJoinToken: null },
    });
    expect(access?.participantId).toBe("part_alex");
    expect(access?.orderId).toBe("ord_1");
  });

  it("denies access when session is not submitted", async () => {
    mockOrderFindUnique.mockResolvedValue({
      id: "ord_1",
      customerPhone: "+15551230000",
      groupOrderSessionId: "gos_1",
    });
    mockSessionFindUnique.mockResolvedValue({ id: "gos_1", status: "active" });
    mockParticipantFindFirst.mockResolvedValue({
      id: "part_alex",
      role: "participant",
      displayName: "Alex",
      groupOrderSessionId: "gos_1",
      leftAt: null,
    });

    const { resolveGroupParticipantOrderAccess } = await import("./group-participant-order-access");
    const access = await resolveGroupParticipantOrderAccess({
      orderId: "ord_1",
      markers: { participantId: "part_alex", legacyJoinToken: null },
    });
    expect(access).toBeNull();
  });

  it("denies host participant row for participant tracking access", async () => {
    mockOrderFindUnique.mockResolvedValue({
      id: "ord_1",
      customerPhone: "+15551230000",
      groupOrderSessionId: "gos_1",
    });
    mockSessionFindUnique.mockResolvedValue({ id: "gos_1", status: "submitted" });
    mockParticipantFindFirst.mockResolvedValue({
      id: "part_host",
      role: "host",
      displayName: "Host",
      groupOrderSessionId: "gos_1",
      leftAt: null,
    });

    const { resolveGroupParticipantOrderAccess } = await import("./group-participant-order-access");
    const access = await resolveGroupParticipantOrderAccess({
      orderId: "ord_1",
      markers: { participantId: "part_host", legacyJoinToken: null },
    });
    expect(access).toBeNull();
  });

  it("allows left participants with valid cookie (items may remain on order)", async () => {
    mockParticipantFindFirst.mockResolvedValue({
      id: "part_alex",
      role: "participant",
      displayName: "Alex",
      groupOrderSessionId: "gos_1",
      leftAt: new Date("2026-06-04T10:00:00Z"),
    });

    const { resolveGroupParticipantForSession } = await import("./group-participant-order-access");
    const row = await resolveGroupParticipantForSession("gos_1", {
      participantId: "part_alex",
      legacyJoinToken: null,
    });
    expect(row?.id).toBe("part_alex");
  });

  it("finds latest order for group session", async () => {
    mockOrderFindFirst.mockResolvedValue({ id: "ord_latest" });
    const { findOrderIdForGroupOrderSession } = await import("./group-participant-order-access");
    const id = await findOrderIdForGroupOrderSession("gos_1");
    expect(id).toBe("ord_latest");
  });
});

describe("customer-order-access wiring", () => {
  it("references participant resolver in assertCustomerOrderAccess", () => {
    const { readFileSync } = require("node:fs");
    const { join } = require("node:path");
    const content = readFileSync(join(process.cwd(), "src/lib/customer-order-access.ts"), "utf8");
    expect(content).toMatch(/resolveGroupParticipantOrderAccess/);
    expect(content).toMatch(/viewerRole: "participant"/);
  });
});

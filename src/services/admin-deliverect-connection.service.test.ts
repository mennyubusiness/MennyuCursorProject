import { PosConnectionStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockApplyChannelRegistrationToVendor = vi.fn();

vi.mock("@/services/deliverect-channel-registration.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/deliverect-channel-registration.service")>();
  return {
    ...actual,
    applyChannelRegistrationToVendor: (...args: unknown[]) =>
      mockApplyChannelRegistrationToVendor(...args),
  };
});

import {
  adminApplyStoredChannelRegistrationPayload,
  adminManualReconnectDeliverect,
  connectVendorToDeliverect,
  disconnectVendorFromDeliverect,
  findDeliverectConnectionOwners,
  normalizeDeliverectChannelLinkId,
} from "./admin-deliverect-connection.service";

function createMockDb() {
  const updates: Array<{ where: unknown; data: unknown }> = [];
  const vendorFindMany = vi.fn();
  const vendorFindUnique = vi.fn();
  const vendorFindFirst = vi.fn();
  const vendorUpdate = vi.fn(async (args: { where: unknown; data: unknown }) => {
    updates.push(args);
    return {};
  });
  const webhookFindUnique = vi.fn();

  const tx = {
    vendor: {
      findMany: vendorFindMany,
      findUnique: vendorFindUnique,
      findFirst: vendorFindFirst,
      update: vendorUpdate,
    },
  };

  const db = {
    vendor: {
      findMany: vendorFindMany,
      findUnique: vendorFindUnique,
      findFirst: vendorFindFirst,
      update: vendorUpdate,
    },
    webhookEvent: { findUnique: webhookFindUnique },
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    _updates: updates,
  };

  return db;
}

describe("normalizeDeliverectChannelLinkId", () => {
  it("strips ch: prefix", () => {
    expect(normalizeDeliverectChannelLinkId("ch:694c302376b27b4e7266dd23")).toBe(
      "694c302376b27b4e7266dd23"
    );
    expect(normalizeDeliverectChannelLinkId("694c302376b27b4e7266dd23")).toBe(
      "694c302376b27b4e7266dd23"
    );
  });
});

describe("disconnectVendorFromDeliverect", () => {
  it("clears all Deliverect/POS fields and sets not_connected", async () => {
    const db = createMockDb();
    db.vendor.findUnique.mockResolvedValue({ id: "v1", name: "Puckstacks" });

    await disconnectVendorFromDeliverect(db as never, "v1");

    expect(db.vendor.update).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: expect.objectContaining({
        deliverectChannelLinkId: null,
        deliverectLocationId: null,
        deliverectAccountId: null,
        deliverectAccountEmail: null,
        pendingDeliverectConnectionKey: null,
        deliverectAutoMapLastAt: null,
        deliverectAutoMapLastOutcome: null,
        deliverectAutoMapLastDetail: null,
        posProvider: null,
        posConnectionStatus: PosConnectionStatus.not_connected,
        autoPublishMenus: false,
      }),
    });
  });
});

describe("findDeliverectConnectionOwners", () => {
  it("returns vendors matching channel link or location", async () => {
    const db = createMockDb();
    db.vendor.findMany.mockResolvedValue([
      {
        id: "old-v",
        name: "Puckstacks",
        deliverectChannelLinkId: "694c302376b27b4e7266dd23",
        deliverectLocationId: "69296696a531758abeeb0701",
        posConnectionStatus: PosConnectionStatus.connected,
      },
    ]);

    const owners = await findDeliverectConnectionOwners(db as never, {
      channelLinkId: "694c302376b27b4e7266dd23",
      locationId: "69296696a531758abeeb0701",
      excludeVendorId: "billy-v",
    });

    expect(owners).toHaveLength(1);
    expect(owners[0]?.vendorId).toBe("old-v");
  });
});

describe("adminManualReconnectDeliverect", () => {
  beforeEach(() => {
    mockApplyChannelRegistrationToVendor.mockReset();
  });

  it("fails without force when another vendor owns channel/location", async () => {
    const db = createMockDb();
    db.vendor.findUnique.mockResolvedValue({ id: "billy-v", name: "Billy" });
    db.vendor.findMany.mockResolvedValue([
      {
        id: "puck-v",
        name: "Puckstacks",
        deliverectChannelLinkId: "694c302376b27b4e7266dd23",
        deliverectLocationId: "69296696a531758abeeb0701",
        posConnectionStatus: PosConnectionStatus.connected,
      },
    ]);

    const result = await adminManualReconnectDeliverect(db as never, {
      targetVendorId: "billy-v",
      channelLinkId: "694c302376b27b4e7266dd23",
      locationId: "69296696a531758abeeb0701",
      forceTransfer: false,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Another vendor already owns");
      expect(result.conflicts).toHaveLength(1);
    }
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("with force disconnects old vendor and connects target", async () => {
    const db = createMockDb();
    db.vendor.findUnique
      .mockResolvedValueOnce({ id: "billy-v", name: "Billy" })
      .mockResolvedValueOnce({ id: "puck-v", name: "Puckstacks" })
      .mockResolvedValueOnce({ id: "billy-v", deliverectChannelLinkId: null });

    db.vendor.findMany.mockResolvedValue([
      {
        id: "puck-v",
        name: "Puckstacks",
        deliverectChannelLinkId: "694c302376b27b4e7266dd23",
        deliverectLocationId: "69296696a531758abeeb0701",
        posConnectionStatus: PosConnectionStatus.connected,
      },
    ]);

    const result = await adminManualReconnectDeliverect(db as never, {
      targetVendorId: "billy-v",
      channelLinkId: "ch:694c302376b27b4e7266dd23",
      locationId: "69296696a531758abeeb0701",
      forceTransfer: true,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.targetVendorId).toBe("billy-v");
      expect(result.channelLinkId).toBe("694c302376b27b4e7266dd23");
      expect(result.disconnectedVendors).toEqual([{ vendorId: "puck-v", vendorName: "Puckstacks" }]);
    }

    const connectUpdate = db._updates.find(
      (u) =>
        (u.data as { deliverectChannelLinkId?: string }).deliverectChannelLinkId ===
        "694c302376b27b4e7266dd23"
    );
    expect(connectUpdate).toBeDefined();
    expect(connectUpdate?.data).toMatchObject({
      posConnectionStatus: PosConnectionStatus.connected,
      pendingDeliverectConnectionKey: null,
      deliverectAutoMapLastOutcome: "manual_reconnect",
    });
  });
});

describe("adminApplyStoredChannelRegistrationPayload", () => {
  beforeEach(() => {
    mockApplyChannelRegistrationToVendor.mockReset();
  });

  it("connects target vendor from stored payload without mutating WebhookEvent", async () => {
    const db = createMockDb();
    const payload = {
      channelLinkId: "694c302376b27b4e7266dd23",
      locationId: "69296696a531758abeeb0701",
      channelLocationId: "cmnquk41z000127jocs3qsxym",
    };

    db.webhookEvent.findUnique.mockResolvedValue({
      id: "cmnr246zj0000kl4z3xbeysdg",
      provider: "deliverect_channel_registration",
      payload,
    });
    db.vendor.findUnique.mockResolvedValue({ id: "billy-v", name: "Billy" });
    db.vendor.findMany.mockResolvedValue([]);

    mockApplyChannelRegistrationToVendor.mockResolvedValue({
      outcome: "success",
      vendorId: "billy-v",
      channelLinkId: "694c302376b27b4e7266dd23",
    });

    const result = await adminApplyStoredChannelRegistrationPayload(db as never, {
      webhookEventId: "cmnr246zj0000kl4z3xbeysdg",
      targetVendorId: "billy-v",
      forceTransfer: false,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.channelLinkId).toBe("694c302376b27b4e7266dd23");
    }
    expect(mockApplyChannelRegistrationToVendor).toHaveBeenCalledWith(
      expect.anything(),
      "billy-v",
      expect.objectContaining({
        channelLinkId: "694c302376b27b4e7266dd23",
        deliverectPortalLocationId: "69296696a531758abeeb0701",
      })
    );
  });

  it("requires force transfer when payload channel is owned elsewhere", async () => {
    const db = createMockDb();
    db.webhookEvent.findUnique.mockResolvedValue({
      id: "ev1",
      provider: "deliverect_channel_registration",
      payload: { channelLinkId: "cl1", locationId: "loc1" },
    });
    db.vendor.findUnique.mockResolvedValue({ id: "target", name: "Target" });
    db.vendor.findMany.mockResolvedValue([
      {
        id: "owner",
        name: "Owner",
        deliverectChannelLinkId: "cl1",
        deliverectLocationId: "loc1",
        posConnectionStatus: PosConnectionStatus.connected,
      },
    ]);

    const result = await adminApplyStoredChannelRegistrationPayload(db as never, {
      webhookEventId: "ev1",
      targetVendorId: "target",
      forceTransfer: false,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.conflicts).toHaveLength(1);
    expect(mockApplyChannelRegistrationToVendor).not.toHaveBeenCalled();
  });
});

describe("connectVendorToDeliverect", () => {
  it("rejects when target already has a different channel link", async () => {
    const db = createMockDb();
    db.vendor.findUnique.mockResolvedValue({
      id: "v1",
      deliverectChannelLinkId: "other-link",
    });

    await expect(
      connectVendorToDeliverect(db as never, {
        vendorId: "v1",
        channelLinkId: "new-link",
      })
    ).rejects.toThrow(/already has channel link/);
  });
});

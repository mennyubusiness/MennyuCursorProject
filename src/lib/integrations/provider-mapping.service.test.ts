import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    providerEntityMapping: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import {
  getProviderEntityMapping,
  hashProviderPayload,
  upsertProviderEntityMapping,
} from "@/lib/integrations/provider-mapping.service";

describe("provider mapping service", () => {
  beforeEach(() => {
    vi.mocked(prisma.providerEntityMapping.findFirst).mockReset();
    vi.mocked(prisma.providerEntityMapping.create).mockReset();
    vi.mocked(prisma.providerEntityMapping.update).mockReset();
  });

  it("hashes payloads deterministically", () => {
    expect(hashProviderPayload({ a: 1 })).toBe(hashProviderPayload({ a: 1 }));
    expect(hashProviderPayload({ a: 1 })).not.toBe(hashProviderPayload({ a: 2 }));
  });

  it("creates with vendor connect and optional connection connect", async () => {
    vi.mocked(prisma.providerEntityMapping.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.providerEntityMapping.create).mockResolvedValue({ id: "map1" } as never);
    const row = await upsertProviderEntityMapping({
      vendorId: "v1",
      connectionId: "conn1",
      provider: "square",
      internalEntityType: "menu_item",
      internalEntityId: "item1",
      externalId: "sq_cat_item_1",
      metadata: { source: "square" },
    });
    expect(row.id).toBe("map1");
    expect(prisma.providerEntityMapping.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        vendor: { connect: { id: "v1" } },
        connection: { connect: { id: "conn1" } },
        externalId: "sq_cat_item_1",
        metadata: { source: "square" },
      }),
    });
    const createArg = vi.mocked(prisma.providerEntityMapping.create).mock.calls[0]?.[0];
    expect(createArg?.data).not.toHaveProperty("vendorId");
    expect(createArg?.data).not.toHaveProperty("connectionId");
  });

  it("updates with connection connect and preserves intentional null scalars", async () => {
    vi.mocked(prisma.providerEntityMapping.findFirst).mockResolvedValue({ id: "map1" } as never);
    vi.mocked(prisma.providerEntityMapping.update).mockResolvedValue({ id: "map1" } as never);

    await upsertProviderEntityMapping({
      vendorId: "v1",
      connectionId: "conn2",
      provider: "square",
      internalEntityType: "menu_item",
      internalEntityId: "item1",
      externalId: "sq_cat_item_2",
      externalParentId: null,
      metadata: { refreshed: true },
    });

    expect(prisma.providerEntityMapping.update).toHaveBeenCalledWith({
      where: { id: "map1" },
      data: expect.objectContaining({
        externalId: "sq_cat_item_2",
        connection: { connect: { id: "conn2" } },
        externalParentId: null,
        metadata: { refreshed: true },
      }),
    });
    const updateArg = vi.mocked(prisma.providerEntityMapping.update).mock.calls[0]?.[0];
    expect(updateArg?.data).not.toHaveProperty("connectionId");
    expect(updateArg?.data).not.toHaveProperty("vendorId");
  });

  it("disconnects optional connection when connectionId is null", async () => {
    vi.mocked(prisma.providerEntityMapping.findFirst).mockResolvedValue({ id: "map1" } as never);
    vi.mocked(prisma.providerEntityMapping.update).mockResolvedValue({ id: "map1" } as never);

    await upsertProviderEntityMapping({
      vendorId: "v1",
      connectionId: null,
      provider: "square",
      internalEntityType: "menu_item",
      internalEntityId: "item1",
      externalId: "sq_cat_item_2",
    });

    const data = vi.mocked(prisma.providerEntityMapping.update).mock.calls[0]?.[0]?.data;
    expect(data).toEqual(
      expect.objectContaining({
        connection: { disconnect: true },
      })
    );
    expect(data).not.toHaveProperty("connectionId");
  });

  it("omits connection on update when connectionId is undefined", async () => {
    vi.mocked(prisma.providerEntityMapping.findFirst).mockResolvedValue({ id: "map1" } as never);
    vi.mocked(prisma.providerEntityMapping.update).mockResolvedValue({ id: "map1" } as never);

    await upsertProviderEntityMapping({
      vendorId: "v1",
      provider: "square",
      internalEntityType: "menu_item",
      internalEntityId: "item1",
      externalId: "sq_cat_item_2",
    });

    const data = vi.mocked(prisma.providerEntityMapping.update).mock.calls[0]?.[0]?.data;
    expect(data).not.toHaveProperty("connection");
    expect(data).not.toHaveProperty("connectionId");
  });

  it("writes Prisma.DbNull when metadata is null on update", async () => {
    vi.mocked(prisma.providerEntityMapping.findFirst).mockResolvedValue({ id: "map1" } as never);
    vi.mocked(prisma.providerEntityMapping.update).mockResolvedValue({ id: "map1" } as never);

    await upsertProviderEntityMapping({
      vendorId: "v1",
      provider: "square",
      internalEntityType: "menu_item",
      internalEntityId: "item1",
      externalId: "sq_cat_item_2",
      metadata: null,
    });

    const data = vi.mocked(prisma.providerEntityMapping.update).mock.calls[0]?.[0]?.data;
    expect(data).toEqual(
      expect.objectContaining({
        metadata: Prisma.DbNull,
      })
    );
  });

  it("reads mapping by composite key", async () => {
    vi.mocked(prisma.providerEntityMapping.findFirst).mockResolvedValue({
      id: "map1",
      externalId: "ext1",
    } as never);
    const row = await getProviderEntityMapping({
      vendorId: "v1",
      provider: "square",
      internalEntityType: "menu_item",
      internalEntityId: "item1",
    });
    expect(row?.externalId).toBe("ext1");
  });
});

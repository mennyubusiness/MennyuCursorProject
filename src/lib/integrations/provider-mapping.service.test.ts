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

  it("upserts mapping rows", async () => {
    vi.mocked(prisma.providerEntityMapping.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.providerEntityMapping.create).mockResolvedValue({ id: "map1" } as never);
    const row = await upsertProviderEntityMapping({
      vendorId: "v1",
      provider: "square",
      internalEntityType: "menu_item",
      internalEntityId: "item1",
      externalId: "sq_cat_item_1",
    });
    expect(row.id).toBe("map1");
    expect(prisma.providerEntityMapping.create).toHaveBeenCalledOnce();
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

import { MenuImportJobStatus, MenuImportSource } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import deliverectFragment from "@/domain/menu-import/__examples__/deliverect-menu-fragment.sample.json";
import { exampleCanonicalMenuSample } from "@/domain/menu-import/__examples__/canonical-output.sample";
import { runPhase1aDeliverectMenuImport } from "@/integrations/deliverect/menu/phase1a-pipeline";
import {
  ingestDeliverectMenuImportPhase1b,
  MenuImportVendorNotFoundError,
} from "./menu-import-phase1b.service";

vi.mock("@/services/menu-auto-publish.service", () => ({
  tryAutoPublishMenuImportJob: vi.fn().mockResolvedValue({ didPublish: false, reason: "skipped_in_unit_test" }),
}));

function makeTxMock() {
  return {
    menuImportJob: {
      create: vi.fn().mockResolvedValue({ id: "job_new" }),
      update: vi.fn().mockResolvedValue(undefined),
    },
    menuImportRawPayload: {
      create: vi.fn().mockResolvedValue({ id: "raw_new" }),
    },
    menuImportIssue: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    menuVersion: {
      create: vi.fn().mockResolvedValue({ id: "ver_new" }),
    },
  };
}

describe("ingestDeliverectMenuImportPhase1b", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when vendor is missing", async () => {
    const client = {
      vendor: { findUnique: vi.fn().mockResolvedValue(null) },
      menuImportJob: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(),
    } as unknown as PrismaClient;

    await expect(
      ingestDeliverectMenuImportPhase1b(
        {
          vendorId: "missing_vendor",
          source: MenuImportSource.DELIVERECT_API_PULL,
          rawPayload: {},
          deliverectMeta: { sourcePayloadKind: "deliverect_menu_api_v1" },
        },
        { prisma: client }
      )
    ).rejects.toThrow(MenuImportVendorNotFoundError);
  });

  it("creates raw payload, job, issues, and draft MenuVersion for sample fragment (mocked prisma)", async () => {
    const tx = makeTxMock();
    const client = {
      vendor: { findUnique: vi.fn().mockResolvedValue({ id: "vendor_1" }) },
      menuImportJob: {
        findUnique: vi.fn().mockResolvedValue(null),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          status: MenuImportJobStatus.awaiting_review,
          draftVersionId: "ver_new",
        }),
      },
      menuImportIssue: {
        count: vi.fn().mockResolvedValue(0),
      },
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => {
        return await fn(tx);
      }),
    } as unknown as PrismaClient;

    const result = await ingestDeliverectMenuImportPhase1b(
      {
        vendorId: "vendor_1",
        source: MenuImportSource.DELIVERECT_API_PULL,
        rawPayload: deliverectFragment,
        deliverectMeta: {
          sourcePayloadKind: "deliverect_menu_api_v1",
          menuId: "sample-menu-001",
        },
      },
      { prisma: client }
    );

    expect(result.deduped).toBe(false);
    expect(result.jobId).toBe("job_new");
    expect(result.rawPayloadId).toBe("raw_new");
    expect(result.draftVersionId).toBe("ver_new");
    expect(result.ok).toBe(true);
    expect(tx.menuImportRawPayload.create).toHaveBeenCalledTimes(1);
    const phase1Preview = runPhase1aDeliverectMenuImport({
      raw: deliverectFragment,
      vendorId: "vendor_1",
      deliverect: {
        sourcePayloadKind: "deliverect_menu_api_v1",
        menuId: "sample-menu-001",
      },
    });
    if (phase1Preview.allIssues.length > 0) {
      expect(tx.menuImportIssue.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining(
          phase1Preview.allIssues.map((i) => expect.objectContaining({ code: i.code }))
        ),
      });
    } else {
      expect(tx.menuImportIssue.createMany).not.toHaveBeenCalled();
    }
    expect(tx.menuVersion.create).toHaveBeenCalledTimes(1);
    expect(client.$transaction).toHaveBeenCalledTimes(2);
  });

  it("does not create MenuVersion when products list is empty", async () => {
    const tx = makeTxMock();
    const client = {
      vendor: { findUnique: vi.fn().mockResolvedValue({ id: "vendor_1" }) },
      menuImportJob: {
        findUnique: vi.fn().mockResolvedValue(null),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          status: MenuImportJobStatus.failed,
          draftVersionId: null,
        }),
      },
      menuImportIssue: {
        count: vi.fn().mockResolvedValue(1),
      },
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => {
        return await fn(tx);
      }),
    } as unknown as PrismaClient;

    const result = await ingestDeliverectMenuImportPhase1b(
      {
        vendorId: "vendor_1",
        source: MenuImportSource.DELIVERECT_API_PULL,
        rawPayload: { products: [] },
        deliverectMeta: { sourcePayloadKind: "deliverect_menu_api_v1" },
      },
      { prisma: client }
    );

    expect(result.menu).toBeNull();
    expect(result.draftVersionId).toBeNull();
    expect(result.jobStatus).toBe(MenuImportJobStatus.failed);
    expect(result.ok).toBe(false);
    expect(tx.menuVersion.create).not.toHaveBeenCalled();
    expect(tx.menuImportIssue.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ code: "EMPTY_PRODUCTS_COLLECTION", kind: "normalization" }),
      ]),
    });
  });

  it("persists issues for invalid root payload and fails job without MenuVersion", async () => {
    const tx = makeTxMock();
    const client = {
      vendor: { findUnique: vi.fn().mockResolvedValue({ id: "vendor_1" }) },
      menuImportJob: {
        findUnique: vi.fn().mockResolvedValue(null),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          status: MenuImportJobStatus.failed,
          draftVersionId: null,
        }),
      },
      menuImportIssue: {
        count: vi.fn().mockResolvedValue(1),
      },
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => {
        return await fn(tx);
      }),
    } as unknown as PrismaClient;

    const result = await ingestDeliverectMenuImportPhase1b(
      {
        vendorId: "vendor_1",
        source: MenuImportSource.DELIVERECT_MENU_WEBHOOK,
        rawPayload: "not-an-object",
        deliverectMeta: { sourcePayloadKind: "deliverect_menu_webhook_v1" },
      },
      { prisma: client }
    );

    expect(result.jobStatus).toBe(MenuImportJobStatus.failed);
    expect(result.draftVersionId).toBeNull();
    expect(tx.menuImportIssue.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([expect.objectContaining({ code: "ROOT_NOT_OBJECT" })]),
    });
    expect(tx.menuVersion.create).not.toHaveBeenCalled();
  });

  it("persists validation issues when duplicate product ids prevent canonical menu", async () => {
    const tx = makeTxMock();
    const client = {
      vendor: { findUnique: vi.fn().mockResolvedValue({ id: "vendor_1" }) },
      menuImportJob: {
        findUnique: vi.fn().mockResolvedValue(null),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          status: MenuImportJobStatus.failed,
          draftVersionId: null,
        }),
      },
      menuImportIssue: {
        count: vi.fn().mockResolvedValue(2),
      },
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => {
        return await fn(tx);
      }),
    } as unknown as PrismaClient;

    const duplicatePayload = {
      products: [
        { _id: "dup", name: "A", price: 100 },
        { _id: "dup", name: "B", price: 200 },
      ],
    };
    const phase1 = runPhase1aDeliverectMenuImport({
      raw: duplicatePayload,
      vendorId: "vendor_1",
      deliverect: { sourcePayloadKind: "deliverect_menu_api_v1" },
    });
    expect(phase1.menu).toBeNull();
    expect(phase1.allIssues.length).toBeGreaterThan(0);

    await ingestDeliverectMenuImportPhase1b(
      {
        vendorId: "vendor_1",
        source: MenuImportSource.DELIVERECT_API_PULL,
        rawPayload: duplicatePayload,
        deliverectMeta: { sourcePayloadKind: "deliverect_menu_api_v1" },
      },
      { prisma: client }
    );

    expect(tx.menuImportIssue.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ kind: "validation", severity: "blocking" }),
      ]),
    });
    expect(tx.menuVersion.create).not.toHaveBeenCalled();
  });

  it("returns deduped snapshot when idempotencyKey hits an existing job", async () => {
    const client = {
      vendor: { findUnique: vi.fn() },
      menuImportJob: {
        findUnique: vi.fn().mockResolvedValue({ id: "job_existing" }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "job_existing",
          status: MenuImportJobStatus.awaiting_review,
          draftVersionId: "ver1",
          menuImportRawPayload: { id: "raw1" },
          draftVersion: { canonicalSnapshot: exampleCanonicalMenuSample },
          issues: [],
        }),
      },
      menuImportIssue: {
        count: vi.fn().mockResolvedValue(0),
      },
      $transaction: vi.fn(),
    } as unknown as PrismaClient;

    const result = await ingestDeliverectMenuImportPhase1b(
      {
        vendorId: "vendor_1",
        source: MenuImportSource.DELIVERECT_API_PULL,
        rawPayload: {},
        deliverectMeta: { sourcePayloadKind: "deliverect_menu_api_v1" },
        idempotencyKey: "idem-1",
      },
      { prisma: client }
    );

    expect(result.deduped).toBe(true);
    expect(client.$transaction).not.toHaveBeenCalled();
    expect(result.menu).not.toBeNull();
    expect(result.jobId).toBe("job_existing");
    expect(result.rawPayloadId).toBe("raw1");
  });
});

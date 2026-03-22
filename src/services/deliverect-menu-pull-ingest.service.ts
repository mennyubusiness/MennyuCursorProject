/**
 * Admin / tooling: pull menu JSON from Deliverect Commerce API and run Phase 1B draft ingest.
 * Does not write live MenuItem rows.
 */
import "server-only";
import { MenuImportSource, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  fetchDeliverectCommerceStoreMenus,
  pickNormalizerInputFromCommerceMenusResponse,
  type DeliverectMenuFulfillmentType,
  type FetchDeliverectStoreMenusResult,
} from "@/integrations/deliverect/menu-api";
import {
  ingestDeliverectMenuImportPhase1b,
  type Phase1bIngestResult,
} from "@/services/menu-import-phase1b.service";

export class DeliverectMenuPullConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeliverectMenuPullConfigError";
  }
}

export class DeliverectMenuPullApiError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number,
    public readonly deliverectBody: unknown
  ) {
    super(message);
    this.name = "DeliverectMenuPullApiError";
  }
}

export type PullDeliverectMenuAndIngestParams = {
  vendorId: string;
  fulfillmentType?: DeliverectMenuFulfillmentType;
  idempotencyKey?: string | null;
  createdBy?: string | null;
  /** Override `Vendor.deliverectAccountId` (Deliverect account id for `/commerce/{accountId}/...`). */
  accountIdOverride?: string | null;
  /** Override `Vendor.deliverectChannelLinkId` (store id in Commerce API = channel link id). */
  channelLinkIdOverride?: string | null;
};

export type PullDeliverectMenuAndIngestResult = Phase1bIngestResult & {
  deliverectFetch: Pick<FetchDeliverectStoreMenusResult, "httpStatus" | "ok"> & {
    error?: string;
  };
};

function tryExtractMenuIdFromCommerceMenusBody(body: unknown): string | undefined {
  if (body == null) return undefined;
  if (Array.isArray(body) && body.length > 0) {
    const first = body[0];
    if (first && typeof first === "object" && !Array.isArray(first)) {
      const o = first as Record<string, unknown>;
      const id = o._id ?? o.id ?? o.menuId;
      if (typeof id === "string" && id.trim()) return id.trim();
    }
  }
  if (typeof body === "object" && !Array.isArray(body)) {
    const o = body as Record<string, unknown>;
    const menus = o.menus;
    if (Array.isArray(menus) && menus.length > 0) {
      const first = menus[0];
      if (first && typeof first === "object" && !Array.isArray(first)) {
        const m = first as Record<string, unknown>;
        const id = m._id ?? m.id ?? m.menuId;
        if (typeof id === "string" && id.trim()) return id.trim();
      }
    }
  }
  return undefined;
}

/**
 * Loads vendor Deliverect ids, GETs store menus from Deliverect, passes **verbatim** JSON body into Phase 1B.
 */
export async function pullDeliverectMenuAndIngestPhase1b(
  params: PullDeliverectMenuAndIngestParams,
  deps: { prisma?: PrismaClient } = {}
): Promise<PullDeliverectMenuAndIngestResult> {
  const client = deps.prisma ?? prisma;

  const vendor = await client.vendor.findUnique({
    where: { id: params.vendorId },
    select: {
      id: true,
      deliverectAccountId: true,
      deliverectChannelLinkId: true,
      deliverectLocationId: true,
    },
  });

  if (!vendor) {
    throw new DeliverectMenuPullConfigError(`Vendor not found: ${params.vendorId}`);
  }

  const accountId =
    (params.accountIdOverride?.trim() || vendor.deliverectAccountId?.trim()) ?? "";
  const storeId =
    (params.channelLinkIdOverride?.trim() || vendor.deliverectChannelLinkId?.trim()) ?? "";

  if (!accountId) {
    throw new DeliverectMenuPullConfigError(
      "Missing Deliverect account id: set Vendor.deliverectAccountId or pass accountIdOverride (Commerce API path /commerce/{accountId}/stores/...)."
    );
  }
  if (!storeId) {
    throw new DeliverectMenuPullConfigError(
      "Missing store/channel link id: set Vendor.deliverectChannelLinkId or pass channelLinkIdOverride (Deliverect uses channel link id as storeId for menu GET)."
    );
  }

  const fetchResult = await fetchDeliverectCommerceStoreMenus({
    accountId,
    storeId,
    fulfillmentType: params.fulfillmentType,
  });

  if (!fetchResult.ok) {
    throw new DeliverectMenuPullApiError(
      fetchResult.error ?? "Deliverect menu request failed",
      fetchResult.httpStatus,
      fetchResult.body
    );
  }

  const rawPayload = fetchResult.body;
  const normalizationCandidate = pickNormalizerInputFromCommerceMenusResponse(rawPayload);
  const normalizationRaw =
    normalizationCandidate !== rawPayload ? normalizationCandidate : undefined;
  const menuIdHint = tryExtractMenuIdFromCommerceMenusBody(rawPayload);

  const ingest = await ingestDeliverectMenuImportPhase1b(
    {
      vendorId: vendor.id,
      source: MenuImportSource.DELIVERECT_API_PULL,
      rawPayload,
      normalizationRaw,
      deliverectMeta: {
        sourcePayloadKind: "deliverect_menu_api_v1",
        channelLinkId: storeId,
        locationId: vendor.deliverectLocationId?.trim() || undefined,
        menuId: menuIdHint,
      },
      idempotencyKey: params.idempotencyKey?.trim() || undefined,
      createdBy: params.createdBy?.trim() || undefined,
    },
    { prisma: client }
  );

  return {
    ...ingest,
    deliverectFetch: {
      ok: true,
      httpStatus: fetchResult.httpStatus,
    },
  };
}

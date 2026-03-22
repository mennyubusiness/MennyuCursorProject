/**
 * POST: Pull published menu(s) from Deliverect Commerce API and ingest as Phase 1B draft (no live menu writes).
 * Admin-only (same gate as other admin APIs).
 */
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, isAdminAllowed } from "@/lib/admin-auth";
import {
  DeliverectMenuPullApiError,
  DeliverectMenuPullConfigError,
  pullDeliverectMenuAndIngestPhase1b,
} from "@/services/deliverect-menu-pull-ingest.service";
import type { DeliverectMenuFulfillmentType } from "@/integrations/deliverect/menu-api";

const FULFILLMENT_TYPES = new Set(["delivery", "pickup", "curbside", "eatIn"]);

function jsonSummary(result: Awaited<ReturnType<typeof pullDeliverectMenuAndIngestPhase1b>>) {
  return {
    jobId: result.jobId,
    draftVersionId: result.draftVersionId,
    jobStatus: result.jobStatus,
    issueCount: result.issueCount,
    ok: result.ok,
    deduped: result.deduped,
    deliverectFetch: result.deliverectFetch,
  };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ vendorId: string }> }
) {
  const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value ?? null;
  const querySecret = request.nextUrl.searchParams.get("admin");
  if (!isAdminAllowed(cookie, querySecret)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { vendorId } = await context.params;
  if (!vendorId?.trim()) {
    return NextResponse.json({ error: "Missing vendorId" }, { status: 400 });
  }

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) {
      body = JSON.parse(text) as unknown;
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const obj = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};

  const fulfillmentRaw = obj.fulfillmentType;
  let fulfillmentType: DeliverectMenuFulfillmentType | undefined;
  if (typeof fulfillmentRaw === "string" && FULFILLMENT_TYPES.has(fulfillmentRaw)) {
    fulfillmentType = fulfillmentRaw as DeliverectMenuFulfillmentType;
  } else if (fulfillmentRaw != null && fulfillmentRaw !== "") {
    return NextResponse.json(
      { error: "fulfillmentType must be one of: delivery, pickup, curbside, eatIn" },
      { status: 400 }
    );
  }

  const idempotencyKey = typeof obj.idempotencyKey === "string" ? obj.idempotencyKey : undefined;
  const createdBy = typeof obj.createdBy === "string" ? obj.createdBy : undefined;
  const accountIdOverride = typeof obj.accountId === "string" ? obj.accountId : undefined;
  const channelLinkIdOverride = typeof obj.channelLinkId === "string" ? obj.channelLinkId : undefined;

  try {
    const result = await pullDeliverectMenuAndIngestPhase1b({
      vendorId: vendorId.trim(),
      fulfillmentType,
      idempotencyKey: idempotencyKey ?? null,
      createdBy: createdBy ?? null,
      accountIdOverride: accountIdOverride ?? null,
      channelLinkIdOverride: channelLinkIdOverride ?? null,
    });
    return NextResponse.json(jsonSummary(result));
  } catch (e) {
    if (e instanceof DeliverectMenuPullConfigError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    if (e instanceof DeliverectMenuPullApiError) {
      return NextResponse.json(
        {
          error: e.message,
          deliverectHttpStatus: e.httpStatus,
          deliverectBody: e.deliverectBody,
        },
        { status: 502 }
      );
    }
    const message = e instanceof Error ? e.message : String(e);
    console.error("[admin deliverect-pull]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

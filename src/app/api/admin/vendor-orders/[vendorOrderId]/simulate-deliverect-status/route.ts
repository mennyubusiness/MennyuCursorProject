/**
 * POST: Push order status to Deliverect (simulate POS). Triggers real webhooks → Mennyu.
 * Does not update VendorOrder locally. Admin-only (same gate as dashboard).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { isAdminApiRequestAuthorized } from "@/lib/admin-auth";
import { postDeliverectOrderStatusUpdate } from "@/integrations/deliverect/client";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ vendorOrderId: string }> }
) {
  if (!(await isAdminApiRequestAuthorized(request))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { vendorOrderId } = await context.params;
  if (!vendorOrderId) {
    return NextResponse.json({ error: "Missing vendorOrderId" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const obj = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  const statusRaw = obj?.status;
  const status =
    typeof statusRaw === "number" && Number.isFinite(statusRaw)
      ? Math.trunc(statusRaw)
      : typeof statusRaw === "string" && /^-?\d+$/.test(statusRaw.trim())
        ? parseInt(statusRaw.trim(), 10)
        : NaN;

  if (!Number.isFinite(status)) {
    return NextResponse.json({ error: "Body must include numeric \"status\"" }, { status: 400 });
  }

  const vo = await prisma.vendorOrder.findUnique({
    where: { id: vendorOrderId },
    select: { id: true, deliverectOrderId: true, vendorId: true },
  });

  if (!vo) {
    return NextResponse.json({ error: "Vendor order not found" }, { status: 404 });
  }

  if (vo.deliverectOrderId == null || String(vo.deliverectOrderId).trim() === "") {
    return NextResponse.json(
      { error: "Vendor order has no deliverectOrderId; cannot push status to Deliverect" },
      { status: 400 }
    );
  }

  const apiKey = env.DELIVERECT_API_KEY?.trim();
  const oauthReady = Boolean(env.DELIVERECT_CLIENT_ID && env.DELIVERECT_CLIENT_SECRET);
  if (!apiKey && !oauthReady) {
    return NextResponse.json(
      {
        error:
          "Deliverect API not configured: set DELIVERECT_API_KEY or DELIVERECT_CLIENT_ID + DELIVERECT_CLIENT_SECRET",
      },
      { status: 503 }
    );
  }

  console.log("[DELIVERECT SIM STATUS REQUEST]", {
    vendorOrderId: vo.id,
    vendorId: vo.vendorId,
    deliverectOrderId: vo.deliverectOrderId,
    status,
  });

  try {
    const result = await postDeliverectOrderStatusUpdate(vo.deliverectOrderId, status);

    console.log("[DELIVERECT SIM STATUS RESPONSE]", {
      statusCode: result.httpStatus,
      body: result.body,
    });

    const ok = result.httpStatus >= 200 && result.httpStatus < 300;

    return NextResponse.json(
      {
        ok,
        statusSent: status,
        deliverectStatusCode: result.httpStatus,
        deliverectResponse: result.body,
      },
      { status: ok ? 200 : result.httpStatus }
    );
  } catch (error) {
    console.error("[DELIVERECT SIM STATUS ERROR]", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        ok: false,
        statusSent: status,
        deliverectStatusCode: 0,
        deliverectResponse: null,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 502 }
    );
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyVendorAccessForApi } from "@/lib/vendor-dashboard-auth";
import {
  parseVendorCustomerOrderingWeek,
  serializeVendorCustomerOrderingWeek,
  validateVendorCustomerOrderingWeek,
  type VendorCustomerOrderingWeek,
} from "@/lib/vendor-customer-ordering-hours";
import { syncVendorCustomerOrderingHoursFromDeliverect } from "@/services/vendor-deliverect-hours-sync.service";

type SaveBody = {
  syncFromDeliverect?: boolean;
  customHours?: VendorCustomerOrderingWeek;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ vendorId: string }> }
) {
  const { vendorId } = await context.params;
  if (!vendorId) {
    return NextResponse.json({ error: "Missing vendorId" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const obj = body && typeof body === "object" ? (body as SaveBody) : null;
  const syncFromDeliverect =
    typeof obj?.syncFromDeliverect === "boolean" ? obj.syncFromDeliverect : null;

  if (syncFromDeliverect === null) {
    return NextResponse.json(
      { error: "Missing or invalid body: { syncFromDeliverect: boolean, customHours?: [...] }" },
      { status: 400 }
    );
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      id: true,
      vendorDashboardToken: true,
      deliverectChannelLinkId: true,
      posConnectionStatus: true,
    },
  });
  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  const access = await verifyVendorAccessForApi(vendorId, request, vendor.vendorDashboardToken);
  if (!access.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const posConnected = Boolean(
    vendor.deliverectChannelLinkId?.trim() && vendor.posConnectionStatus === "connected"
  );

  if (syncFromDeliverect && !posConnected) {
    return NextResponse.json(
      { error: "Connect your POS before syncing customer ordering hours from Deliverect." },
      { status: 400 }
    );
  }

  let customerOrderingHours: VendorCustomerOrderingWeek | undefined;
  if (!syncFromDeliverect) {
    const parsed = parseVendorCustomerOrderingWeek(obj?.customHours);
    if (!parsed) {
      return NextResponse.json({ error: "Custom customer ordering hours are required." }, { status: 400 });
    }
    const validationError = validateVendorCustomerOrderingWeek(parsed);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
    customerOrderingHours = serializeVendorCustomerOrderingWeek(parsed);
  }

  await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      syncCustomerOrderingHoursFromDeliverect: syncFromDeliverect,
      ...(customerOrderingHours ? { customerOrderingHours } : {}),
    },
  });

  if (syncFromDeliverect) {
    const syncResult = await syncVendorCustomerOrderingHoursFromDeliverect(vendorId);
    if ("skipped" in syncResult) {
      return NextResponse.json({
        ok: true,
        syncFromDeliverect,
        customHours: customerOrderingHours ?? null,
        hoursSync: { ok: false, error: "Hours sync skipped" },
      });
    }
    return NextResponse.json({
      ok: true,
      syncFromDeliverect,
      customHours: customerOrderingHours ?? null,
      hoursSync: syncResult.ok
        ? { ok: true, syncedAt: syncResult.syncedAt }
        : { ok: false, error: syncResult.error, keptPreviousHours: syncResult.keptPreviousHours },
    });
  }

  return NextResponse.json({
    ok: true,
    syncFromDeliverect,
    customHours: customerOrderingHours ?? null,
  });
}

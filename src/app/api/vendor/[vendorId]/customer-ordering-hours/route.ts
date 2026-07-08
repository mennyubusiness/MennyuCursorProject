import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { revalidateVendorCustomerOrderingSurfaces } from "@/lib/revalidate-vendor-pod-surfaces.server";
import { verifyVendorAccessForApi } from "@/lib/vendor-dashboard-auth";
import {
  parseVendorCustomerOrderingWeek,
  serializeVendorCustomerOrderingWeek,
  validateVendorCustomerOrderingWeek,
  type VendorCustomerOrderingWeek,
} from "@/lib/vendor-customer-ordering-hours";

type SaveBody = {
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
  const parsed = parseVendorCustomerOrderingWeek(obj?.customHours);
  if (!parsed) {
    return NextResponse.json({ error: "Customer ordering hours are required." }, { status: 400 });
  }
  const validationError = validateVendorCustomerOrderingWeek(parsed);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }
  const customerOrderingHours = serializeVendorCustomerOrderingWeek(parsed);

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      id: true,
      vendorDashboardToken: true,
    },
  });
  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  const access = await verifyVendorAccessForApi(vendorId, request, vendor.vendorDashboardToken);
  if (!access.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      syncCustomerOrderingHoursFromDeliverect: false,
      customerOrderingHours,
    },
  });

  await revalidateVendorCustomerOrderingSurfaces(vendorId);

  return NextResponse.json({
    ok: true,
    syncFromDeliverect: false,
    customHours: customerOrderingHours,
  });
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  canDeleteVendor,
  deleteVendorProfile,
} from "@/services/entity-deletion.service";

type DeleteVendorBody = {
  confirmation?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ vendorId: string }> }
) {
  const { vendorId } = await context.params;
  if (!vendorId) {
    return NextResponse.json({ error: "Missing vendorId" }, { status: 400 });
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await canDeleteVendor(userId, vendorId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: DeleteVendorBody = {};
  try {
    body = (await request.json()) as DeleteVendorBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.confirmation?.trim().toUpperCase() !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm vendor deletion." }, { status: 400 });
  }

  const result = await deleteVendorProfile({ vendorId, actorUserId: userId });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, blockers: result.blockers ?? [] },
      { status: result.blockers ? 409 : 400 }
    );
  }

  return NextResponse.json({ ok: true, redirectTo: "/account" });
}

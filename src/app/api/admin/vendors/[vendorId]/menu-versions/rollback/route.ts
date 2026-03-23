/**
 * POST: Roll back live menu to a copy of an archived MenuVersion snapshot (new published row + apply canonical to live tables).
 * Body: { sourceMenuVersionId: string, rolledBackBy?: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { isAdminApiRequestAuthorized } from "@/lib/admin-auth";
import {
  MenuPublishValidationError,
} from "@/services/menu-publish-from-canonical.service";
import { rollbackVendorPublishedMenu } from "@/services/menu-rollback-published.service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ vendorId: string }> }
) {
  if (!(await isAdminApiRequestAuthorized(request))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { vendorId } = await context.params;
  if (!vendorId?.trim()) {
    return NextResponse.json({ error: "Missing vendorId" }, { status: 400 });
  }

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) body = JSON.parse(text) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const obj = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const sourceMenuVersionId =
    typeof obj.sourceMenuVersionId === "string" ? obj.sourceMenuVersionId : "";
  const rolledBackBy = typeof obj.rolledBackBy === "string" ? obj.rolledBackBy : undefined;

  if (!sourceMenuVersionId.trim()) {
    return NextResponse.json({ error: "sourceMenuVersionId is required" }, { status: 400 });
  }

  try {
    const result = await rollbackVendorPublishedMenu({
      vendorId: vendorId.trim(),
      sourceMenuVersionId: sourceMenuVersionId.trim(),
      rolledBackBy: rolledBackBy ?? null,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof MenuPublishValidationError) {
      const status =
        e.code === "SOURCE_NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    const message = e instanceof Error ? e.message : String(e);
    console.error("[admin menu rollback]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST: Publish a reviewed draft MenuVersion (Deliverect import) to live menu tables.
 * Admin-only. No body required. Idempotent: returns already_published if draft was already published.
 */
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, isAdminAllowed } from "@/lib/admin-auth";
import {
  MenuPublishValidationError,
  publishMenuImportDraftToLive,
} from "@/services/menu-publish-from-canonical.service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value ?? null;
  const querySecret = request.nextUrl.searchParams.get("admin");
  if (!isAdminAllowed(cookie, querySecret)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { jobId } = await context.params;
  if (!jobId?.trim()) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  try {
    const result = await publishMenuImportDraftToLive({ jobId: jobId.trim() });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof MenuPublishValidationError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : String(e);
    console.error("[admin menu-import publish]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

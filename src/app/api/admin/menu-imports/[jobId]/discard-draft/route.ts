/**
 * POST: Discard (delete) the draft MenuVersion linked to this import job.
 * Admin-only. Retains MenuImportJob, issues, and raw payload; clears draft link and sets job to cancelled.
 */
import { NextRequest, NextResponse } from "next/server";
import { isAdminApiRequestAuthorized } from "@/lib/admin-auth";
import {
  DraftMenuVersionDiscardError,
  discardDraftMenuVersionForImportJob,
} from "@/services/discard-draft-menu-version.service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  if (!(await isAdminApiRequestAuthorized(request))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { jobId } = await context.params;
  if (!jobId?.trim()) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  try {
    const result = await discardDraftMenuVersionForImportJob({
      jobId: jobId.trim(),
      discardedBy: "admin",
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof DraftMenuVersionDiscardError) {
      const status = e.code === "JOB_NOT_FOUND" || e.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    const message = e instanceof Error ? e.message : String(e);
    console.error("[admin menu-import discard-draft]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

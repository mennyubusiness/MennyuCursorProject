/**
 * PATCH: resolve vendor order issue or update notes.
 */
import { NextResponse } from "next/server";
import { isAdminApiRequestAuthorized } from "@/lib/admin-auth";
import {
  resolveVendorOrderIssue,
  updateVendorOrderIssueNotes,
} from "@/services/issues.service";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ issueId: string }> }
) {
  if (!(await isAdminApiRequestAuthorized(request))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { issueId } = await context.params;
  if (!issueId) {
    return NextResponse.json({ error: "Missing issueId" }, { status: 400 });
  }

  let body: { resolve?: boolean; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.resolve === true) {
    await resolveVendorOrderIssue(issueId, { resolvedBy: "admin" });
    return NextResponse.json({ ok: true, action: "resolved" });
  }
  if (typeof body.notes === "string") {
    await updateVendorOrderIssueNotes(issueId, body.notes || null);
    return NextResponse.json({ ok: true, action: "notes_updated" });
  }

  return NextResponse.json(
    { error: "Provide resolve: true or notes: string" },
    { status: 400 }
  );
}

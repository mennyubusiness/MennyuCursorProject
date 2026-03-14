/**
 * PATCH: resolve order issue or update notes.
 */
import { NextResponse } from "next/server";
import {
  resolveOrderIssue,
  updateOrderIssueNotes,
} from "@/services/issues.service";

export async function PATCH(
  _request: Request,
  context: { params: Promise<{ issueId: string }> }
) {
  const { issueId } = await context.params;
  if (!issueId) {
    return NextResponse.json({ error: "Missing issueId" }, { status: 400 });
  }

  let body: { resolve?: boolean; notes?: string };
  try {
    body = await _request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.resolve === true) {
    await resolveOrderIssue(issueId, { resolvedBy: "admin" });
    return NextResponse.json({ ok: true, action: "resolved" });
  }
  if (typeof body.notes === "string") {
    await updateOrderIssueNotes(issueId, body.notes || null);
    return NextResponse.json({ ok: true, action: "notes_updated" });
  }

  return NextResponse.json(
    { error: "Provide resolve: true or notes: string" },
    { status: 400 }
  );
}

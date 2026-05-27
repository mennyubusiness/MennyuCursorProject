/**
 * PATCH: admin actions on OrderIssue (system + customer support).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { isAdminApiRequestAuthorized } from "@/lib/admin-auth";
import { ORDER_ISSUE_STATUSES } from "@/domain/order-support-issue";
import {
  resolveOrderIssue,
  updateOrderIssueNotes,
} from "@/services/issues.service";
import { updateAdminSupportIssue } from "@/services/order-support-issue.service";

const patchSchema = z.object({
  resolve: z.boolean().optional(),
  dismiss: z.boolean().optional(),
  reviewing: z.boolean().optional(),
  status: z.enum(ORDER_ISSUE_STATUSES).optional(),
  notes: z.string().max(5000).optional().nullable(),
  internalNote: z.string().max(5000).optional().nullable(),
  linkedOrderRefundId: z.string().min(1).optional().nullable(),
});

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const session = await auth();
  const adminUserId = session?.user?.id ?? null;

  const data = parsed.data;

  if (data.resolve === true) {
    await resolveOrderIssue(issueId, {
      resolvedBy: "admin",
      resolvedByUserId: adminUserId ?? undefined,
    });
    return NextResponse.json({ ok: true, action: "resolved" });
  }

  if (data.dismiss === true) {
    const r = await updateAdminSupportIssue(issueId, {
      status: "dismissed",
      resolvedByUserId: adminUserId,
    });
    if (!r.ok) return NextResponse.json({ error: r.message }, { status: 404 });
    return NextResponse.json({ ok: true, action: "dismissed" });
  }

  if (data.reviewing === true) {
    const r = await updateAdminSupportIssue(issueId, { status: "reviewing" });
    if (!r.ok) return NextResponse.json({ error: r.message }, { status: 404 });
    return NextResponse.json({ ok: true, action: "reviewing" });
  }

  if (data.status) {
    const r = await updateAdminSupportIssue(issueId, {
      status: data.status,
      resolvedByUserId:
        data.status === "resolved" || data.status === "dismissed" ? adminUserId : null,
    });
    if (!r.ok) return NextResponse.json({ error: r.message }, { status: 404 });
    return NextResponse.json({ ok: true, action: "status_updated" });
  }

  const note =
    data.internalNote !== undefined ? data.internalNote : data.notes;
  if (note !== undefined) {
    await updateOrderIssueNotes(issueId, note || null);
    await updateAdminSupportIssue(issueId, { internalNote: note || null });
    return NextResponse.json({ ok: true, action: "notes_updated" });
  }

  if (data.linkedOrderRefundId !== undefined) {
    const r = await updateAdminSupportIssue(issueId, {
      linkedOrderRefundId: data.linkedOrderRefundId,
    });
    if (!r.ok) return NextResponse.json({ error: r.message }, { status: 404 });
    return NextResponse.json({ ok: true, action: "refund_linked" });
  }

  return NextResponse.json(
    { error: "Provide resolve, dismiss, reviewing, status, notes, or linkedOrderRefundId" },
    { status: 400 }
  );
}

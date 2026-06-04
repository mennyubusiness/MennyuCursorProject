import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminApiRequestAuthorized } from "@/lib/admin-auth";
import { LEGACY_CLAWBACK_REVIEW_STATUSES } from "@/lib/legacy-clawback-review";
import {
  LegacyClawbackReviewError,
  markLegacyClawbackReview,
} from "@/services/legacy-clawback-review.service";

const bodySchema = z.object({
  status: z.enum(LEGACY_CLAWBACK_REVIEW_STATUSES),
  note: z.string().min(1).max(4000),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ vendorPayoutTransferId: string }> }
) {
  if (!(await isAdminApiRequestAuthorized(request))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { vendorPayoutTransferId } = await context.params;
  if (!vendorPayoutTransferId) {
    return NextResponse.json({ error: "Missing vendorPayoutTransferId" }, { status: 400 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const result = await markLegacyClawbackReview({
      vendorPayoutTransferId,
      status: body.status,
      note: body.note,
      reviewedBy: "admin",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof LegacyClawbackReviewError) {
      const status =
        e.code === "NOT_FOUND" ? 404 : e.code === "NOTE_REQUIRED" ? 400 : 409;
      return NextResponse.json({ ok: false, code: e.code, error: e.message }, { status });
    }
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

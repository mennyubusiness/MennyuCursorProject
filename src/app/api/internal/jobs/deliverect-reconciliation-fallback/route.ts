/**
 * POST/GET: run automatic Deliverect reconciliation fallback for overdue vendor orders (Vercel Cron).
 * Requires INTERNAL_JOB_SECRET: Authorization: Bearer <secret> or ?secret=
 */
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { runDeliverectAutomaticReconciliationFallback } from "@/services/deliverect-reconciliation-fallback-job.service";

function authorizeInternalJob(request: NextRequest): boolean {
  const secret = env.INTERNAL_JOB_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return request.nextUrl.searchParams.get("secret") === secret;
}

export async function POST(request: NextRequest) {
  if (!env.INTERNAL_JOB_SECRET?.trim()) {
    return NextResponse.json(
      { ok: false, error: "INTERNAL_JOB_SECRET is not configured" },
      { status: 503 }
    );
  }
  if (!authorizeInternalJob(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let take: number | undefined;
  try {
    const body = await request.json().catch(() => ({}));
    if (body && typeof body === "object" && typeof (body as { take?: unknown }).take === "number") {
      const t = Math.floor((body as { take: number }).take);
      if (t > 0 && t <= 200) take = t;
    }
  } catch {
    /* no body */
  }
  const qTake = request.nextUrl.searchParams.get("take");
  if (qTake) {
    const t = parseInt(qTake, 10);
    if (!Number.isNaN(t) && t > 0 && t <= 200) take = t;
  }

  const summary = await runDeliverectAutomaticReconciliationFallback(
    take != null ? { take } : undefined
  );

  return NextResponse.json({
    ok: true,
    summary: {
      scanned: summary.scanned,
      eligible: summary.eligible,
      attempted: summary.attempted,
      claimed: summary.claimed,
      successApplied: summary.successApplied,
      noop: summary.noop,
      noMatch: summary.noMatch,
      ambiguous: summary.ambiguous,
      notEligible: summary.notEligible,
      errors: summary.errors,
      skippedAlreadyClaimed: summary.skippedAlreadyClaimed,
    },
  });
}

export async function GET(request: NextRequest) {
  return POST(request);
}

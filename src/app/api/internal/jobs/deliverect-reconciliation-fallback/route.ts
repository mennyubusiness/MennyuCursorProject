/**
 * Vercel Cron + manual: automatic Deliverect GET fallback for overdue vendor orders.
 *
 * Auth — compare timing-safe against the first configured secret (same value recommended):
 * - INTERNAL_JOB_SECRET, or
 * - CRON_SECRET (Vercel may send `Authorization: Bearer <CRON_SECRET>` on scheduled crons)
 *
 * Also accepted:
 * - Authorization: Bearer <secret>
 * - ?secret= (GET cron from vercel.json cannot set headers; use dashboard URL with &secret= if needed)
 *
 * Disable: unset both secrets (returns 503) or remove the cron in vercel.json / dashboard.
 *
 * @see docs/deliverect-vercel-cron.md
 */
import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { runDeliverectAutomaticReconciliationFallback } from "@/services/deliverect-reconciliation-fallback-job.service";

/** No static caching; cron must always run fresh. */
export const dynamic = "force-dynamic";

const LOG_CRON = "[Deliverect auto-reconciliation cron]";

function safeEqualSecret(provided: string | null | undefined, expected: string): boolean {
  if (provided == null || provided === "") return false;
  try {
    const a = Buffer.from(provided, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function resolveJobSecret(): string | null {
  return env.INTERNAL_JOB_SECRET?.trim() || env.CRON_SECRET?.trim() || null;
}

/** Bearer (incl. Vercel Cron automatic Bearer) or query `secret`. */
function authorizeInternalJob(request: NextRequest): boolean {
  const expected = resolveJobSecret();
  if (!expected) return false;

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    if (safeEqualSecret(token, expected)) return true;
  }

  const q = request.nextUrl.searchParams.get("secret");
  if (q && safeEqualSecret(q, expected)) return true;

  return false;
}

async function handleJob(request: NextRequest): Promise<NextResponse> {
  if (!resolveJobSecret()) {
    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_JOB_SECRET or CRON_SECRET must be configured",
        job: "deliverect_auto_reconciliation",
      },
      { status: 503, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }

  if (!authorizeInternalJob(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized", job: "deliverect_auto_reconciliation" },
      { status: 401, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }

  let take: number | undefined;
  if (request.method === "POST") {
    try {
      const body = await request.json().catch(() => ({}));
      if (body && typeof body === "object" && typeof (body as { take?: unknown }).take === "number") {
        const t = Math.floor((body as { take: number }).take);
        if (t > 0 && t <= 200) take = t;
      }
    } catch {
      /* invalid json */
    }
  }
  const qTake = request.nextUrl.searchParams.get("take");
  if (qTake) {
    const t = parseInt(qTake, 10);
    if (!Number.isNaN(t) && t > 0 && t <= 200) take = t;
  }

  console.info(
    `${LOG_CRON} http_accepted method=${request.method} path=${request.nextUrl.pathname} take=${take ?? "default"}`
  );

  const summary = await runDeliverectAutomaticReconciliationFallback(
    take != null ? { take } : undefined
  );

  const payload = {
    ok: true as const,
    job: "deliverect_auto_reconciliation",
    at: new Date().toISOString(),
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
  };

  console.info(`${LOG_CRON} http_response ${JSON.stringify(payload.summary)}`);

  return NextResponse.json(payload, {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/** Vercel Cron schedules GET by default. */
export async function GET(request: NextRequest) {
  return handleJob(request);
}

/** Manual / tools: optional JSON body { "take": number }. Same auth as GET. */
export async function POST(request: NextRequest) {
  return handleJob(request);
}

/**
 * Vercel Cron + manual: retry pending/failed vendor Connect transfers.
 *
 * Auth — same pattern as deliverect-reconciliation-fallback:
 * - INTERNAL_JOB_SECRET, or CRON_SECRET
 * - Authorization: Bearer <secret> or ?secret=
 */
import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { retryEligibleVendorPayoutTransfersJob } from "@/services/vendor-payout-transfer.service";

export const dynamic = "force-dynamic";

const LOG_CRON = "[Vendor payout transfer retry cron]";

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
        job: "vendor_payout_transfer_retry",
      },
      { status: 503, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }

  if (!authorizeInternalJob(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized", job: "vendor_payout_transfer_retry" },
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

  const result = await retryEligibleVendorPayoutTransfersJob(take != null ? { take } : undefined);

  const payload = {
    ok: result.ok,
    job: "vendor_payout_transfer_retry",
    at: new Date().toISOString(),
    ...(result.ok
      ? { summary: result.summary }
      : {
          error: result.error,
          code: result.code,
          balanceError: result.balanceError,
          summary: result.summary,
        }),
  };

  console.info(`${LOG_CRON} http_response ${JSON.stringify(payload)}`);

  return NextResponse.json(payload, {
    status: result.ok ? 200 : 503,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function GET(request: NextRequest) {
  return handleJob(request);
}

export async function POST(request: NextRequest) {
  return handleJob(request);
}

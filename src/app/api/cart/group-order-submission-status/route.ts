import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readGroupOrderParticipantMarkers } from "@/lib/group-order-participant-cookie";
import { getGroupOrderSubmissionStatusForParticipantCart } from "@/lib/group-participant-submitted-cart";

/**
 * GET /api/cart/group-order-submission-status?cartId=...
 * Participant-only: session status + submitted order id when host checkout completes.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const cartId = url.searchParams.get("cartId")?.trim();
  if (!cartId) {
    return NextResponse.json({ ok: false as const, error: "Missing cartId" }, { status: 400 });
  }

  const store = await cookies();
  const markers = readGroupOrderParticipantMarkers(store);
  const result = await getGroupOrderSubmissionStatusForParticipantCart({ cartId, markers });

  if (!result.ok) {
    return NextResponse.json({ ok: false as const, error: "Forbidden" }, { status: result.status });
  }

  return NextResponse.json(result);
}

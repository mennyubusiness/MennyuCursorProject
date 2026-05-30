/**
 * POST /api/orders/set-phone
 * @deprecated Phase 2 — order history requires verified CustomerSession (phone OTP).
 */
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "Verify your phone on the orders page to view order history.",
      code: "CUSTOMER_SESSION_REQUIRED",
    },
    { status: 410 }
  );
}

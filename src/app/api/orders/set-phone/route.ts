/**
 * POST /api/orders/set-phone
 * @deprecated Legacy order-access bootstrap; returns 410. Use SMS signed links or sign in for order history.
 */
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "This endpoint is no longer supported. Open your order from the SMS link or sign in to view your order history.",
      code: "CUSTOMER_SESSION_REQUIRED",
    },
    { status: 410 }
  );
}

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { assertCustomerSession } from "@/lib/customer-session";
import { linkCheckoutCustomerAccountToUser } from "@/services/customer-account-link.service";

/**
 * POST /api/customer/account/link
 * Links verified checkout phone (CustomerSession) to the signed-in User account.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, code: "SIGN_IN_REQUIRED", error: "Sign in to link your phone." },
      { status: 401 }
    );
  }

  const customerSession = await assertCustomerSession(request.headers);
  if (!customerSession.ok) {
    return NextResponse.json(
      { ok: false, code: "NO_CUSTOMER_SESSION", error: "Verify your phone at checkout first." },
      { status: 401 }
    );
  }

  const result = await linkCheckoutCustomerAccountToUser({
    userId: session.user.id,
    customerAccountId: customerSession.customerAccountId,
    phoneE164: customerSession.phoneE164,
  });

  if (!result.ok) {
    const status =
      result.code === "ALREADY_LINKED_OTHER"
        ? 409
        : result.code === "SIGN_IN_REQUIRED" || result.code === "NO_CUSTOMER_SESSION"
          ? 401
          : 400;
    return NextResponse.json({ ok: false, code: result.code, error: result.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    alreadyLinked: result.alreadyLinked,
    legacyOrdersAttached: result.legacyOrdersAttached,
    message: result.alreadyLinked
      ? "Phone is already linked to this account."
      : "Phone linked to your account. Order history will include orders from this phone.",
  });
}

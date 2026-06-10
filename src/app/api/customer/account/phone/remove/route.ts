import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  buildClearCustomerSessionCookieHeader,
  revokeCustomerSessionFromRequest,
} from "@/lib/customer-session";
import { removePhoneFromUserAccount } from "@/services/customer-account-phone.service";

/**
 * POST /api/customer/account/phone/remove
 * Unlinks phone from the signed-in account, opts out of SMS, and clears device checkout session.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "Sign in to remove your phone number." },
      { status: 401 }
    );
  }

  const result = await removePhoneFromUserAccount(session.user.id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  await revokeCustomerSessionFromRequest(request);

  const response = NextResponse.json({ ok: true });
  response.headers.set("Set-Cookie", buildClearCustomerSessionCookieHeader());
  return response;
}

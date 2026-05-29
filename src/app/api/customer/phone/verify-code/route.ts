import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildCustomerSessionCookieHeader } from "@/lib/customer-session";
import { verifyPhoneVerificationCode } from "@/services/customer-phone-otp.service";

const bodySchema = z.object({
  phone: z.string().min(1),
  code: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Phone and verification code are required." }, { status: 400 });
  }

  const result = await verifyPhoneVerificationCode(parsed.data.phone, parsed.data.code);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const response = NextResponse.json({
    ok: true,
    phoneVerified: true,
    phoneE164: result.phoneE164,
  });
  response.headers.set("Set-Cookie", buildCustomerSessionCookieHeader(result.sessionToken));
  return response;
}

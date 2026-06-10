import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { buildCustomerSessionCookieHeader } from "@/lib/customer-session";
import { normalizePhoneToE164US } from "@/lib/phone-e164";
import { linkVerifiedPhoneToUserAfterOtp } from "@/services/customer-account-link.service";
import { recordSmsOptIn } from "@/lib/sms-opt-out.service";
import { RATE_LIMITS, rateLimitKeys } from "@/lib/rate-limit";
import { applyRateLimits, getClientIp } from "@/lib/rate-limit-http";
import { verifyPhoneVerificationCode } from "@/services/customer-phone-otp.service";

const bodySchema = z.object({
  phone: z.string().min(1),
  code: z.string().min(1),
  smsConsent: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Phone and verification code are required." }, { status: 400 });
  }

  const ip = getClientIp(request);
  const normalized = normalizePhoneToE164US(parsed.data.phone);
  const phoneKey = normalized.ok ? normalized.e164 : `raw:${parsed.data.phone.trim()}`;

  const limited = applyRateLimits([
    {
      key: rateLimitKeys.otpVerifyPhone(phoneKey),
      ...RATE_LIMITS.otpVerifyPhone,
    },
    {
      key: rateLimitKeys.otpVerifyIp(ip),
      ...RATE_LIMITS.otpVerifyIp,
    },
  ]);
  if (limited) return limited;

  const result = await verifyPhoneVerificationCode(parsed.data.phone, parsed.data.code);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const authSession = await auth();
  if (authSession?.user?.id) {
    await linkVerifiedPhoneToUserAfterOtp({
      userId: authSession.user.id,
      customerAccountId: result.customerAccountId,
      phoneE164: result.phoneE164,
    }).catch(() => undefined);
  }

  if (parsed.data.smsConsent) {
    await recordSmsOptIn(result.phoneE164);
  }

  const response = NextResponse.json({
    ok: true,
    phoneVerified: true,
    phoneE164: result.phoneE164,
    linkedToAccount: Boolean(authSession?.user?.id),
  });
  response.headers.set("Set-Cookie", buildCustomerSessionCookieHeader(result.sessionToken));
  return response;
}

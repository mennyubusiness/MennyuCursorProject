import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { normalizePhoneToE164US } from "@/lib/phone-e164";
import { RATE_LIMITS, rateLimitKeys } from "@/lib/rate-limit";
import { applyRateLimits, getClientIp } from "@/lib/rate-limit-http";
import { sendPhoneVerificationCode } from "@/services/customer-phone-otp.service";

const bodySchema = z.object({
  phone: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Phone number is required." }, { status: 400 });
  }

  const ip = getClientIp(request);
  const normalized = normalizePhoneToE164US(parsed.data.phone);
  const phoneKey = normalized.ok ? normalized.e164 : `raw:${parsed.data.phone.trim()}`;

  const limited = applyRateLimits([
    {
      key: rateLimitKeys.otpSendPhone(phoneKey),
      ...RATE_LIMITS.otpSendPhone,
    },
    {
      key: rateLimitKeys.otpSendIp(ip),
      ...RATE_LIMITS.otpSendIp,
    },
  ]);
  if (limited) return limited;

  const result = await sendPhoneVerificationCode(parsed.data.phone);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, message: result.message });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendPhoneVerificationCode } from "@/services/customer-phone-otp.service";

const bodySchema = z.object({
  phone: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Phone number is required." }, { status: 400 });
  }

  const result = await sendPhoneVerificationCode(parsed.data.phone);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, message: result.message });
}

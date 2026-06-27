"use server";

import { headers } from "next/headers";
import { auth } from "@/auth";
import { sendEmailVerificationEmail } from "@/services/email-verification.service";

export type ResendEmailVerificationResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function resendEmailVerificationAction(): Promise<ResendEmailVerificationResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Sign in to resend verification email." };
  }

  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  const proto = headersList.get("x-forwarded-proto") ?? "https";
  const requestOrigin = host ? `${proto}://${host}` : undefined;

  return sendEmailVerificationEmail({
    userId: session.user.id,
    requestOrigin,
    initiator: "user",
  });
}

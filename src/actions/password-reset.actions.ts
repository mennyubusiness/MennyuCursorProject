"use server";

import { headers } from "next/headers";
import { getPublicSiteOrigin } from "@/lib/public-site-url";
import {
  RATE_LIMITS,
  RATE_LIMIT_ERROR_MESSAGE,
  enforceRateLimits,
  rateLimitKeys,
} from "@/lib/rate-limit";
import { getClientIpFromHeaders } from "@/lib/rate-limit-http";
import { normalizeAccountEmail } from "@/lib/auth/password-policy";
import {
  requestPasswordReset,
  resetPasswordWithToken,
  type RequestPasswordResetResult,
  type ResetPasswordResult,
} from "@/services/password-reset.service";

export async function requestPasswordResetAction(email: string): Promise<RequestPasswordResetResult> {
  const headersList = await headers();
  const ip = getClientIpFromHeaders(headersList);
  const emailNorm = normalizeAccountEmail(email);

  const limited = enforceRateLimits([
    {
      key: rateLimitKeys.passwordResetRequestIp(ip),
      ...RATE_LIMITS.passwordResetRequestIp,
    },
    {
      key: rateLimitKeys.passwordResetRequestEmail(emailNorm),
      ...RATE_LIMITS.passwordResetRequestEmail,
    },
  ]);
  if (limited) {
    return { ok: false, error: RATE_LIMIT_ERROR_MESSAGE };
  }

  const origin = await getPublicSiteOrigin();
  return requestPasswordReset(email, origin);
}

export async function resetPasswordAction(
  token: string,
  newPassword: string
): Promise<ResetPasswordResult> {
  const headersList = await headers();
  const ip = getClientIpFromHeaders(headersList);

  const limited = enforceRateLimits([
    {
      key: rateLimitKeys.passwordResetAttemptIp(ip),
      ...RATE_LIMITS.passwordResetAttemptIp,
    },
  ]);
  if (limited) {
    return { ok: false, error: RATE_LIMIT_ERROR_MESSAGE };
  }

  return resetPasswordWithToken(token, newPassword);
}

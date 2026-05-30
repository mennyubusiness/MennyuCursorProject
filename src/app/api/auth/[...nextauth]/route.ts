import { handlers } from "@/auth";
import { NextRequest } from "next/server";
import { RATE_LIMITS, rateLimitKeys } from "@/lib/rate-limit";
import { applyRateLimits, getClientIp } from "@/lib/rate-limit-http";

const { GET, POST: nextAuthPost } = handlers;

export { GET };

async function extractLoginEmail(request: NextRequest): Promise<string | null> {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    const clone = request.clone();
    if (contentType.includes("application/json")) {
      const body = (await clone.json()) as { email?: unknown };
      if (typeof body.email === "string" && body.email.trim()) {
        return body.email.toLowerCase().trim();
      }
      return null;
    }
    if (contentType.includes("form")) {
      const fd = await clone.formData();
      const email = String(fd.get("email") ?? "").trim();
      return email ? email.toLowerCase() : null;
    }
  } catch {
    return null;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const checks = [
    {
      key: rateLimitKeys.loginIp(ip),
      ...RATE_LIMITS.login,
    },
  ];

  const email = await extractLoginEmail(request);
  if (email) {
    checks.push({
      key: rateLimitKeys.loginEmail(email),
      ...RATE_LIMITS.login,
    });
  }

  const limited = applyRateLimits(checks);
  if (limited) return limited;

  return nextAuthPost(request);
}

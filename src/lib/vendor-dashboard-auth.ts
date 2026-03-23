/**
 * Vendor dashboard access: per-vendor secret + httpOnly cookie (or Bearer on API).
 * Development: same pattern as admin — gate open for local iteration (NODE_ENV === "development").
 * Production: requires Vendor.vendorDashboardToken to be set and a matching cookie or Authorization header.
 */
import { timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

export const vendorDashboardCookieName = (vendorId: string) => `mennyu_vdash_${vendorId}`;

export function timingSafeStringEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/** True when vendor dashboard routes should skip token checks (local dev only). */
export function isVendorDashboardDevOpen(): boolean {
  return env.NODE_ENV === "development";
}

/**
 * API / server: verify caller may act as this vendor (cookie or Bearer vs stored token).
 */
export async function verifyVendorDashboardRequest(
  vendorId: string,
  request: Request,
  vendorDashboardToken: string | null
): Promise<boolean> {
  if (isVendorDashboardDevOpen()) return true;
  if (!vendorDashboardToken?.trim()) return false;
  const expected = vendorDashboardToken.trim();

  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (bearer && timingSafeStringEqual(bearer, expected)) return true;

  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    const name = `${vendorDashboardCookieName(vendorId)}=`;
    const match = cookieHeader.split(";").map((c) => c.trim()).find((c) => c.startsWith(name));
    if (match) {
      const value = decodeURIComponent(match.slice(name.length));
      if (timingSafeStringEqual(value, expected)) return true;
    }
  }

  return false;
}

/**
 * Server actions / RSC: verify httpOnly cookie set by bindVendorDashboardSession.
 */
export async function verifyVendorDashboardCookie(
  vendorId: string,
  vendorDashboardToken: string | null
): Promise<boolean> {
  if (isVendorDashboardDevOpen()) return true;
  if (!vendorDashboardToken?.trim()) return false;
  const cookieStore = await cookies();
  const c = cookieStore.get(vendorDashboardCookieName(vendorId))?.value;
  if (!c) return false;
  return timingSafeStringEqual(c.trim(), vendorDashboardToken.trim());
}

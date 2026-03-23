/**
 * Shared httpOnly session cookie for vendor dashboard (publish, discard, settings, etc.).
 */
import "server-only";
import { cookies } from "next/headers";
import { vendorDashboardCookieName } from "@/lib/vendor-dashboard-auth";

export async function setVendorDashboardSessionCookie(vendorId: string, plaintextSecret: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(vendorDashboardCookieName(vendorId), plaintextSecret.trim(), {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 90,
  });
}

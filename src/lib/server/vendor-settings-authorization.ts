/**
 * Shared authorization for vendor settings writes (brand profile, uploads, etc.).
 */
import "server-only";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ADMIN_COOKIE_NAME, isAdminAllowed } from "@/lib/admin-auth";
import { canViewVendor } from "@/lib/permissions";
import {
  isVendorDashboardDevOpen,
  timingSafeStringEqual,
  vendorDashboardCookieName,
} from "@/lib/vendor-dashboard-auth";

export async function authorizeVendorSettingsWrite(vendorId: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const id = vendorId.trim();
  const v = await prisma.vendor.findUnique({
    where: { id },
    select: { vendorDashboardToken: true },
  });
  if (!v) return { ok: false, error: "Vendor not found" };

  if (isVendorDashboardDevOpen()) return { ok: true };

  const cookieStore = await cookies();
  if (isAdminAllowed(cookieStore.get(ADMIN_COOKIE_NAME)?.value ?? null, null)) {
    return { ok: true };
  }

  const session = await auth();
  if (session?.user?.id) {
    const allowed = await canViewVendor(session.user.id, id);
    if (allowed) return { ok: true };
  }

  const c = cookieStore.get(vendorDashboardCookieName(id))?.value;
  if (
    c &&
    v.vendorDashboardToken &&
    timingSafeStringEqual(c.trim(), v.vendorDashboardToken.trim())
  ) {
    return { ok: true };
  }

  return {
    ok: false,
    error:
      "Unauthorized: sign in with a vendor-linked account, or complete access using an API/browser session from Settings → Automation & API access.",
  };
}

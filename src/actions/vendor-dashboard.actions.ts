"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ADMIN_COOKIE_NAME, isAdminAllowed } from "@/lib/admin-auth";
import {
  isVendorDashboardDevOpen,
  timingSafeStringEqual,
  vendorDashboardCookieName,
} from "@/lib/vendor-dashboard-auth";
import { setVendorDashboardSessionCookie } from "@/lib/vendor-dashboard-session";

export async function bindVendorDashboardSession(
  vendorId: string,
  tokenPlain: string
): Promise<{ ok: boolean; error?: string }> {
  const v = await prisma.vendor.findUnique({
    where: { id: vendorId.trim() },
    select: { vendorDashboardToken: true },
  });
  if (!v?.vendorDashboardToken?.trim()) {
    return { ok: false, error: "No access token is configured for this vendor yet. Ask your Mennyu admin to generate one." };
  }
  if (!timingSafeStringEqual(tokenPlain.trim(), v.vendorDashboardToken.trim())) {
    return { ok: false, error: "Token does not match." };
  }

  await setVendorDashboardSessionCookie(vendorId, tokenPlain.trim());

  revalidatePath(`/vendor/${vendorId}`);
  revalidatePath(`/vendor/${vendorId}/settings`);
  revalidatePath(`/vendor/${vendorId}/menu`);
  revalidatePath(`/vendor/${vendorId}/menu-imports`);
  return { ok: true };
}

export async function updateVendorAutoPublishMenus(
  vendorId: string,
  autoPublishMenus: boolean
): Promise<{ ok: boolean; error?: string }> {
  const v = await prisma.vendor.findUnique({
    where: { id: vendorId.trim() },
    select: { vendorDashboardToken: true },
  });
  if (!v) return { ok: false, error: "Vendor not found" };

  if (!isVendorDashboardDevOpen()) {
    const cookieStore = await cookies();
    if (isAdminAllowed(cookieStore.get(ADMIN_COOKIE_NAME)?.value ?? null, null)) {
      await prisma.vendor.update({
        where: { id: vendorId.trim() },
        data: { autoPublishMenus },
      });
      revalidatePath(`/vendor/${vendorId}/settings`);
      return { ok: true };
    }

    const session = await auth();
    if (session?.user?.isPlatformAdmin) {
      await prisma.vendor.update({
        where: { id: vendorId.trim() },
        data: { autoPublishMenus },
      });
      revalidatePath(`/vendor/${vendorId}/settings`);
      return { ok: true };
    }
    if (session?.user?.id) {
      const m = await prisma.vendorMembership.findUnique({
        where: { userId_vendorId: { userId: session.user.id, vendorId } },
      });
      if (m) {
        await prisma.vendor.update({
          where: { id: vendorId.trim() },
          data: { autoPublishMenus },
        });
        revalidatePath(`/vendor/${vendorId}/settings`);
        return { ok: true };
      }
    }

    const c = cookieStore.get(vendorDashboardCookieName(vendorId))?.value;
    if (
      c &&
      v.vendorDashboardToken &&
      timingSafeStringEqual(c.trim(), v.vendorDashboardToken.trim())
    ) {
      await prisma.vendor.update({
        where: { id: vendorId.trim() },
        data: { autoPublishMenus },
      });
      revalidatePath(`/vendor/${vendorId}/settings`);
      return { ok: true };
    }

    return {
      ok: false,
      error: "Unauthorized: sign in with a vendor-linked account, or use a legacy vendor session token.",
    };
  }

  await prisma.vendor.update({
    where: { id: vendorId.trim() },
    data: { autoPublishMenus },
  });

  revalidatePath(`/vendor/${vendorId}/settings`);
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  isVendorDashboardDevOpen,
  timingSafeStringEqual,
  vendorDashboardCookieName,
} from "@/lib/vendor-dashboard-auth";
import { cookies } from "next/headers";

export async function bindVendorDashboardSession(
  vendorId: string,
  tokenPlain: string
): Promise<{ ok: boolean; error?: string }> {
  const v = await prisma.vendor.findUnique({
    where: { id: vendorId.trim() },
    select: { vendorDashboardToken: true },
  });
  if (!v?.vendorDashboardToken?.trim()) {
    return { ok: false, error: "No dashboard token is configured for this vendor yet. Ask your Mennyu admin to generate one." };
  }
  if (!timingSafeStringEqual(tokenPlain.trim(), v.vendorDashboardToken.trim())) {
    return { ok: false, error: "Token does not match." };
  }

  const cookieStore = await cookies();
  cookieStore.set(vendorDashboardCookieName(vendorId), tokenPlain.trim(), {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 90,
  });

  revalidatePath(`/vendor/${vendorId}`);
  revalidatePath(`/vendor/${vendorId}/settings`);
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
    const c = cookieStore.get(vendorDashboardCookieName(vendorId))?.value;
    if (!c || !v.vendorDashboardToken || !timingSafeStringEqual(c.trim(), v.vendorDashboardToken.trim())) {
      return { ok: false, error: "Unauthorized: paste dashboard token on this page first." };
    }
  }

  await prisma.vendor.update({
    where: { id: vendorId.trim() },
    data: { autoPublishMenus },
  });

  revalidatePath(`/vendor/${vendorId}/settings`);
  return { ok: true };
}

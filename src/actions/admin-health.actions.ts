"use server";

import { revalidatePath } from "next/cache";
import { requireAdminActionContext } from "@/lib/admin-action-context";
import {
  adminRecheckOrderHealth,
  adminRerunPaymentValidation,
} from "@/services/admin-health-actions.service";

type ActionResult = { ok: true; message: string } | { ok: false; error: string };

async function withAdmin<T extends ActionResult>(
  fn: (ctx: { adminUserId: string | null }) => Promise<T>
): Promise<T | { ok: false; error: string }> {
  const ctx = await requireAdminActionContext();
  if (!ctx.ok) return ctx;
  return fn(ctx);
}

export async function adminRerunPaymentValidationAction(orderId: string, reason: string) {
  return withAdmin(async ({ adminUserId }) => {
    const result = await adminRerunPaymentValidation({ orderId, adminUserId, reason });
    if (result.ok) {
      revalidatePath("/admin/health");
      revalidatePath("/admin/incidents");
      revalidatePath(`/admin/orders/${orderId}`);
    }
    return result;
  });
}

export async function adminRecheckOrderHealthAction(orderId: string, reason: string) {
  return withAdmin(async ({ adminUserId }) => {
    const result = await adminRecheckOrderHealth({ orderId, adminUserId, reason });
    if (result.ok) {
      revalidatePath("/admin/health");
      revalidatePath("/admin/incidents");
      revalidatePath(`/admin/orders/${orderId}`);
    }
    return result;
  });
}

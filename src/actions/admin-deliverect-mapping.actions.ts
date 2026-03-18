"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

function mappingPath(vendorId: string) {
  return `/admin/vendors/${vendorId}/deliverect-mapping`;
}

export async function setMenuItemDeliverectProductId(
  menuItemId: string,
  vendorId: string,
  deliverectProductId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const item = await prisma.menuItem.findFirst({
    where: { id: menuItemId, vendorId },
    select: { id: true },
  });
  if (!item) return { ok: false, error: "Menu item not found for this vendor." };
  const trimmed = deliverectProductId.trim();
  await prisma.menuItem.update({
    where: { id: menuItemId },
    data: { deliverectProductId: trimmed === "" ? null : trimmed },
  });
  revalidatePath(mappingPath(vendorId));
  return { ok: true };
}

export async function setModifierOptionDeliverectModifierId(
  modifierOptionId: string,
  vendorId: string,
  deliverectModifierId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const opt = await prisma.modifierOption.findFirst({
    where: { id: modifierOptionId, modifierGroup: { vendorId } },
    select: { id: true },
  });
  if (!opt) return { ok: false, error: "Modifier option not found for this vendor." };
  const trimmed = deliverectModifierId.trim();
  await prisma.modifierOption.update({
    where: { id: modifierOptionId },
    data: { deliverectModifierId: trimmed === "" ? null : trimmed },
  });
  revalidatePath(mappingPath(vendorId));
  return { ok: true };
}

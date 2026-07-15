"use server";

import { revalidatePath } from "next/cache";
import { requireAdminActionContext } from "@/lib/admin-action-context";
import { ADMIN_AUDIT_ACTION, ADMIN_AUDIT_TARGET } from "@/lib/admin-audit-log";
import { createAdminAuditLog } from "@/services/admin-audit-log.service";
import { deactivateSquareMappingsOutsideLocation } from "@/lib/integrations/provider-mapping.service";
import { getActiveSquareConnectionForVendor } from "@/lib/integrations/square/square-connection.service";
import { revalidateVendorCustomerOrderingSurfaces } from "@/lib/revalidate-vendor-pod-surfaces.server";

/**
 * Admin recovery: deactivate Square ProviderEntityMapping rows outside the selected location.
 */
export async function adminDeactivateSquareMappingsOutsideSelectedLocationAction(
  vendorId: string
): Promise<{ ok: true; deactivated: number } | { ok: false; error: string }> {
  const ctx = await requireAdminActionContext();
  if (!ctx.ok) return ctx;

  const connection = await getActiveSquareConnectionForVendor(vendorId);
  const locationId = connection?.externalLocationId?.trim();
  if (!locationId) {
    return { ok: false, error: "Vendor has no active Square location selected." };
  }

  const deactivated = await deactivateSquareMappingsOutsideLocation({
    vendorId,
    selectedLocationId: locationId,
  });

  await createAdminAuditLog({
    adminUserId: ctx.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.SQUARE_STALE_MAPPINGS_DEACTIVATED,
    targetType: ADMIN_AUDIT_TARGET.vendor,
    targetId: vendorId,
    reason: "Admin deactivated Square mappings outside selected location",
    newValue: locationId,
    metadata: {
      vendorId,
      selectedLocationId: locationId,
      mappingsDeactivated: deactivated,
      occurredAt: new Date().toISOString(),
    },
  });

  revalidatePath(`/admin/vendors/${vendorId}`);
  await revalidateVendorCustomerOrderingSurfaces(vendorId);
  return { ok: true, deactivated };
}

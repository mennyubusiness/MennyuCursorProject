"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { canManageVendor } from "@/lib/permissions";
import { revalidateVendorCustomerOrderingSurfaces } from "@/lib/revalidate-vendor-pod-surfaces.server";
import {
  disconnectSquareForVendor,
  selectSquareLocationForVendor,
} from "@/lib/integrations/square/square-connection.service";
import { getSquareConfigSnapshot } from "@/lib/integrations/square/square-config";

export async function selectSquareLocationAction(
  vendorId: string,
  locationId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Not signed in." };
  if (!(await canManageVendor(userId, vendorId))) {
    return { ok: false, error: "You don’t have permission to manage integrations for this vendor." };
  }

  const result = await selectSquareLocationForVendor({
    vendorId,
    locationId,
    actorUserId: userId,
  });
  if (!result.ok) return result;

  revalidatePath(`/vendor/${vendorId}/setup`);
  revalidatePath(`/vendor/${vendorId}/integrations/square`);
  await revalidateVendorCustomerOrderingSurfaces(vendorId);
  return { ok: true };
}

export async function disconnectSquareAction(
  vendorId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Not signed in." };
  if (!(await canManageVendor(userId, vendorId))) {
    return { ok: false, error: "You don’t have permission." };
  }

  await disconnectSquareForVendor(vendorId);
  revalidatePath(`/vendor/${vendorId}/setup`);
  revalidatePath(`/vendor/${vendorId}/integrations/square`);
  await revalidateVendorCustomerOrderingSurfaces(vendorId);
  return { ok: true };
}

export async function getSquareIntegrationUiState(vendorId: string) {
  const snap = getSquareConfigSnapshot();
  const { getActiveSquareConnectionForVendor, evaluateSquareConnectionHealth } = await import(
    "@/lib/integrations/square/square-connection.service"
  );
  const { loadSquareOrderRoutingReadiness } = await import(
    "@/lib/integrations/square/square-order-routing-readiness"
  );
  const [connection, health, routingReadiness] = await Promise.all([
    getActiveSquareConnectionForVendor(vendorId),
    evaluateSquareConnectionHealth(vendorId),
    loadSquareOrderRoutingReadiness(vendorId),
  ]);
  return { snap, connection, health, routingReadiness };
}

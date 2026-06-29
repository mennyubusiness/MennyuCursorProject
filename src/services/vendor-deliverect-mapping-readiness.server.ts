import "server-only";

import type { VendorOrderRoutingMode } from "@prisma/client";
import { isDeliverectRoutingMode } from "@/lib/vendor-order-routing-mode";
import { evaluateDeliverectMenuIntegrityForVendor } from "@/services/deliverect-menu-integrity.service";

/** Deliverect-mode vendors only; manual-mode vendors are omitted (treated as mapping-ready). */
export async function loadVendorDeliverectMappingReadyMap(
  vendorIds: string[],
  routingModes: Map<string, VendorOrderRoutingMode>
): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  const deliverectIds = vendorIds.filter((id) => isDeliverectRoutingMode(routingModes.get(id)));

  await Promise.all(
    deliverectIds.map(async (vendorId) => {
      try {
        const report = await evaluateDeliverectMenuIntegrityForVendor(vendorId);
        map.set(vendorId, report.deliverectReady);
      } catch {
        map.set(vendorId, false);
      }
    })
  );

  return map;
}

import "server-only";

import { prisma } from "@/lib/db";
import { isSquareRoutingMode } from "@/lib/vendor-order-routing-mode";
import { getActiveSquareConnectionForVendor } from "@/lib/integrations/square/square-connection.service";
import { evaluateSquareCartLinesRoutability } from "@/lib/integrations/square/square-mapping-coverage.server";
import {
  buildSquareRoutingFailurePayload,
  SQUARE_CART_PREFLIGHT_CUSTOMER_MESSAGE,
  SQUARE_CART_PREFLIGHT_FAILED,
} from "@/lib/integrations/square/square-routing-failure";
import { loadSquareOrderRoutingReadiness } from "@/lib/integrations/square/square-order-routing-readiness";

export type SquareCartPreflightLine = {
  id: string;
  menuItemId: string;
  vendorId: string;
  menuItem: {
    name: string;
    isAvailable: boolean;
    deliverectProductId?: string | null;
  };
  selections?: Array<{ modifierOptionId: string }>;
};

export type SquareCartPreflightFailure = {
  valid: false;
  code: typeof SQUARE_CART_PREFLIGHT_FAILED;
  message: string;
  cartItemId?: string;
  menuItemId?: string;
  menuItemName?: string;
  vendorId?: string;
};

/**
 * Exact-cart Square routability check before payment.
 * Does not create Square orders or charge the customer.
 */
export async function validateSquareCartPreflight(
  items: SquareCartPreflightLine[]
): Promise<{ valid: true } | SquareCartPreflightFailure> {
  if (items.length === 0) return { valid: true };

  const vendorIds = [...new Set(items.map((i) => i.vendorId))];
  const vendors = await prisma.vendor.findMany({
    where: { id: { in: vendorIds } },
    select: { id: true, orderRoutingMode: true },
  });
  const squareVendorIds = vendors
    .filter((v) => isSquareRoutingMode(v.orderRoutingMode))
    .map((v) => v.id);

  if (squareVendorIds.length === 0) return { valid: true };

  const optionIds = [
    ...new Set(items.flatMap((i) => i.selections?.map((s) => s.modifierOptionId) ?? [])),
  ];
  const options =
    optionIds.length > 0
      ? await prisma.modifierOption.findMany({
          where: { id: { in: optionIds } },
          select: { id: true, name: true, deliverectModifierId: true },
        })
      : [];
  const optionById = new Map(options.map((o) => [o.id, o]));

  for (const vendorId of squareVendorIds) {
    const readiness = await loadSquareOrderRoutingReadiness(vendorId);
    if (!readiness.prerequisitesReady) {
      const vendorItems = items.filter((i) => i.vendorId === vendorId);
      const first = vendorItems[0];
      const failure = buildSquareRoutingFailurePayload({
        code: SQUARE_CART_PREFLIGHT_FAILED,
        stage: "cart_preflight",
        vendorId,
        selectedLocationId: readiness.locationId,
        missingMenuItemIds: readiness.mappingCoverage.missingItemIds,
        missingModifierOptionIds: readiness.mappingCoverage.missingRequiredModifierOptionIds,
        alternateLocationIds: readiness.mappingCoverage.alternateLocationIds,
        summary: readiness.prerequisiteBlockers.join("; ") || "Square routing not ready",
      });
      console.error("[square-cart-preflight] vendor not routing-ready", failure);

      return {
        valid: false,
        code: SQUARE_CART_PREFLIGHT_FAILED,
        message: SQUARE_CART_PREFLIGHT_CUSTOMER_MESSAGE,
        cartItemId: first?.id,
        menuItemId: first?.menuItemId,
        menuItemName: first?.menuItem.name,
        vendorId,
      };
    }

    const connection = await getActiveSquareConnectionForVendor(vendorId);
    const locationId = connection?.externalLocationId ?? readiness.locationId;
    if (!connection || !locationId?.trim()) {
      const first = items.find((i) => i.vendorId === vendorId);
      return {
        valid: false,
        code: SQUARE_CART_PREFLIGHT_FAILED,
        message: SQUARE_CART_PREFLIGHT_CUSTOMER_MESSAGE,
        cartItemId: first?.id,
        menuItemId: first?.menuItemId,
        menuItemName: first?.menuItem.name,
        vendorId,
      };
    }

    const vendorLines = items.filter((i) => i.vendorId === vendorId);
    const lineResult = await evaluateSquareCartLinesRoutability({
      vendorId,
      selectedLocationId: locationId,
      lines: vendorLines.map((line) => ({
        cartItemId: line.id,
        menuItemId: line.menuItemId,
        menuItemName: line.menuItem.name,
        deliverectProductId: line.menuItem.deliverectProductId,
        isAvailable: line.menuItem.isAvailable,
        selections: (line.selections ?? []).map((s) => {
          const opt = optionById.get(s.modifierOptionId);
          return {
            modifierOptionId: s.modifierOptionId,
            deliverectModifierId: opt?.deliverectModifierId ?? null,
            name: opt?.name,
          };
        }),
      })),
    });

    if (!lineResult.ok) {
      const failedLine =
        vendorLines.find((l) => lineResult.missingMenuItemIds.includes(l.menuItemId)) ??
        vendorLines[0];
      const failure = buildSquareRoutingFailurePayload({
        code: SQUARE_CART_PREFLIGHT_FAILED,
        stage: "cart_preflight",
        vendorId,
        merchantId: connection.externalMerchantId,
        selectedLocationId: locationId,
        missingMenuItemIds: lineResult.missingMenuItemIds,
        missingModifierOptionIds: lineResult.missingModifierOptionIds,
        alternateLocationIds: lineResult.alternateLocationIds,
        summary: lineResult.blockers.map((b) => b.message).join("; "),
        providerErrors: { blockers: lineResult.blockers },
      });
      console.error("[square-cart-preflight] cart lines not routable", failure);

      return {
        valid: false,
        code: SQUARE_CART_PREFLIGHT_FAILED,
        message: SQUARE_CART_PREFLIGHT_CUSTOMER_MESSAGE,
        cartItemId: failedLine?.id,
        menuItemId: failedLine?.menuItemId,
        menuItemName: failedLine?.menuItem.name,
        vendorId,
      };
    }
  }

  return { valid: true };
}

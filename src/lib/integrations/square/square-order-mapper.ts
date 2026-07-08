import "server-only";

import { prisma } from "@/lib/db";
import type { HydratedVendorOrder } from "@/integrations/deliverect/load";
import { getProviderEntityMapping } from "@/lib/integrations/provider-mapping.service";
import {
  isSquareModifierOptionDeliverectId,
  isSquareProductDeliverectId,
} from "@/lib/integrations/square/square-menu-ids";
import type {
  SquareCreateOrderRequest,
  SquareOrderLineItem,
  SquarePickupFulfillment,
} from "@/lib/integrations/square/square-order.types";
import { getPickupCode } from "@/lib/pickup-code";

export type SquareOrderMappingIssue = {
  code: string;
  message: string;
  menuItemId?: string;
  modifierOptionId?: string;
};

export type SquareOrderMapResult =
  | {
      ok: true;
      request: SquareCreateOrderRequest;
      lineItemCount: number;
      modifierCount: number;
    }
  | { ok: false; issues: SquareOrderMappingIssue[] };

const OPEN_ORDER_SOURCE_NAME = "Open Order";

export async function mapVendorOrderToSquareCreateOrder(input: {
  vendorOrder: NonNullable<HydratedVendorOrder>;
  locationId: string;
  idempotencyKey: string;
  customerDisplayName?: string | null;
}): Promise<SquareOrderMapResult> {
  const { vendorOrder, locationId } = input;
  const issues: SquareOrderMappingIssue[] = [];
  const lineItems: SquareOrderLineItem[] = [];
  let modifierCount = 0;

  for (const line of vendorOrder.lineItems) {
    const productInternalId = line.menuItem.deliverectProductId;
    if (!productInternalId?.trim() || !isSquareProductDeliverectId(productInternalId)) {
      issues.push({
        code: "MISSING_ITEM_MAPPING",
        message: `Menu item "${line.name}" is missing a Square catalog mapping.`,
        menuItemId: line.menuItemId,
      });
      continue;
    }

    const itemMapping = await getProviderEntityMapping({
      vendorId: vendorOrder.vendorId,
      provider: "square",
      internalEntityType: "menu_item",
      internalEntityId: productInternalId,
      externalLocationId: locationId,
    });

    if (!itemMapping?.isActive || !itemMapping.externalId?.trim()) {
      issues.push({
        code: "MISSING_ITEM_MAPPING",
        message: `No active Square mapping for menu item "${line.name}".`,
        menuItemId: line.menuItemId,
      });
      continue;
    }

    const modifiers: SquareOrderLineItem["modifiers"] = [];
    for (const selection of line.selections) {
      const modInternalId = selection.modifierOption.deliverectModifierId;
      if (!modInternalId?.trim() || !isSquareModifierOptionDeliverectId(modInternalId)) {
        issues.push({
          code: "MISSING_MODIFIER_MAPPING",
          message: `Modifier "${selection.modifierOption.name}" on "${line.name}" is missing a Square mapping.`,
          menuItemId: line.menuItemId,
          modifierOptionId: selection.modifierOption.id,
        });
        continue;
      }

      const modMapping = await getProviderEntityMapping({
        vendorId: vendorOrder.vendorId,
        provider: "square",
        internalEntityType: "modifier_option",
        internalEntityId: modInternalId,
        externalLocationId: locationId,
      });

      if (!modMapping?.isActive || !modMapping.externalId?.trim()) {
        issues.push({
          code: "MISSING_MODIFIER_MAPPING",
          message: `No active Square mapping for modifier "${selection.modifierOption.name}" on "${line.name}".`,
          menuItemId: line.menuItemId,
          modifierOptionId: selection.modifierOption.id,
        });
        continue;
      }

      modifiers.push({
        catalog_object_id: modMapping.externalId,
        quantity: "1",
      });
      modifierCount += 1;
    }

    if (issues.some((i) => i.menuItemId === line.menuItemId)) {
      continue;
    }

    const noteParts = [line.specialInstructions?.trim()].filter(Boolean);
    lineItems.push({
      quantity: String(line.quantity),
      catalog_object_id: itemMapping.externalId,
      ...(noteParts.length > 0 ? { note: noteParts.join(" · ") } : {}),
      ...(modifiers.length > 0 ? { modifiers } : {}),
    });
  }

  if (lineItems.length === 0) {
    issues.push({
      code: "EMPTY_ORDER",
      message: "Order has no mappable line items for Square.",
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const pickupNotes: string[] = [];
  const orderNote = vendorOrder.order.orderNotes?.trim();
  if (orderNote) pickupNotes.push(orderNote);
  pickupNotes.push(`Pickup code: ${getPickupCode(vendorOrder.order.id)}`);

  const fulfillment: SquarePickupFulfillment = {
    type: "PICKUP",
    state: "PROPOSED",
    pickup_details: {
      schedule_type: "ASAP",
      ...(input.customerDisplayName?.trim()
        ? { recipient: { display_name: input.customerDisplayName.trim() } }
        : {}),
      ...(pickupNotes.length > 0 ? { note: pickupNotes.join(" · ") } : {}),
    },
  };

  const request: SquareCreateOrderRequest = {
    idempotency_key: input.idempotencyKey,
    order: {
      location_id: locationId,
      reference_id: vendorOrder.id,
      source: { name: OPEN_ORDER_SOURCE_NAME },
      line_items: lineItems,
      fulfillments: [fulfillment],
      state: "OPEN",
    },
  };

  return {
    ok: true,
    request,
    lineItemCount: lineItems.length,
    modifierCount,
  };
}

export async function getVendorOrderForSquare(vendorOrderId: string) {
  return prisma.vendorOrder.findUnique({
    where: { id: vendorOrderId },
    include: {
      order: true,
      vendor: true,
      lineItems: {
        include: {
          menuItem: {
            select: {
              id: true,
              name: true,
              deliverectProductId: true,
            },
          },
          selections: {
            include: {
              modifierOption: {
                select: {
                  id: true,
                  name: true,
                  deliverectModifierId: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

/**
 * Load a VendorOrder with all related data needed for Deliverect payload transformation.
 * Includes order (for customer refs and order notes), line items, selections, and
 * modifier option/group data for nested structure.
 */
import { prisma } from "@/lib/db";

export type HydratedVendorOrder = Awaited<ReturnType<typeof getVendorOrderForDeliverect>>;

/**
 * Fetch a single VendorOrder fully hydrated for transformation.
 * Returns null if not found.
 */
export async function getVendorOrderForDeliverect(vendorOrderId: string) {
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
              deliverectPlu: true,
              deliverectVariantParentPlu: true,
              deliverectVariantParentName: true,
            },
          },
          selections: {
            include: {
              modifierOption: {
                include: {
                  modifierGroup: {
                    select: {
                      id: true,
                      name: true,
                      sortOrder: true,
                      parentModifierOptionId: true,
                      deliverectIsVariantGroup: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}

/**
 * Fetch all VendorOrders for an Order, fully hydrated for Deliverect.
 * Use for dev payload inspection or batch submission.
 */
export async function getOrderVendorOrdersForDeliverect(orderId: string) {
  return prisma.vendorOrder.findMany({
    where: { orderId },
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
              deliverectPlu: true,
              deliverectVariantParentPlu: true,
              deliverectVariantParentName: true,
            },
          },
          selections: {
            include: {
              modifierOption: {
                include: {
                  modifierGroup: {
                    select: {
                      id: true,
                      name: true,
                      sortOrder: true,
                      parentModifierOptionId: true,
                      deliverectIsVariantGroup: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

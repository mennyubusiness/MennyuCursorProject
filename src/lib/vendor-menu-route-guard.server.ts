import "server-only";

import { notFound, redirect } from "next/navigation";
import type { VendorMenuSource, VendorOrderRoutingMode } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  getVendorMenuManagementMode,
  vendorMenuManagementPath,
} from "@/lib/vendor-menu-management";
import {
  isDeliverectMenuSource,
  isOpenOrderMenuSource,
  type VendorMenuSourceFields,
} from "@/lib/vendor-menu-source";
import { integratedOrderRoutingLabel } from "@/lib/integrations/provider-display";

export { integratedOrderRoutingLabel };

export type VendorMenuSourceContext = VendorMenuSourceFields & {
  id: string;
  name: string;
  slug: string;
};

export async function loadVendorMenuSourceContext(
  vendorId: string
): Promise<VendorMenuSourceContext | null> {
  return prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      id: true,
      name: true,
      slug: true,
      menuSource: true,
      orderRoutingMode: true,
      deliverectChannelLinkId: true,
    },
  });
}

export async function requireVendorMenuSourceContext(vendorId: string): Promise<VendorMenuSourceContext> {
  const vendor = await loadVendorMenuSourceContext(vendorId);
  if (!vendor) notFound();
  return vendor;
}

/** Redirect manual vendors away from integrated Menu Imports tooling. */
export function gateMenuImportsRoutes(
  vendor: Pick<VendorMenuSourceFields, "orderRoutingMode">,
  vendorId: string
) {
  if (getVendorMenuManagementMode(vendor.orderRoutingMode) === "builder") {
    redirect(vendorMenuManagementPath(vendorId, vendor.orderRoutingMode));
  }
}

/** @deprecated Use gateMenuImportsRoutes — kept for existing imports. */
export function gateDeliverectMenuRoutes(
  vendor: Pick<VendorMenuSourceFields, "menuSource" | "orderRoutingMode">,
  vendorId: string
) {
  gateMenuImportsRoutes(vendor, vendorId);
}

/** Redirect integrated-route vendors away from Open Order Menu Builder. */
export function gateOpenOrderMenuBuilderRoutes(
  vendor: Pick<VendorMenuSourceFields, "orderRoutingMode">,
  vendorId: string
) {
  if (getVendorMenuManagementMode(vendor.orderRoutingMode) === "imports") {
    redirect(vendorMenuManagementPath(vendorId, vendor.orderRoutingMode));
  }
}

/** Menu source checks for publish/canonical validation — not primary nav routing. */
export function vendorUsesMenuBuilderByMenuSource(menuSource: VendorMenuSource): boolean {
  return menuSource === "open_order";
}

export function vendorUsesMenuBuilder(menuSource: VendorMenuSource): boolean {
  return vendorUsesMenuBuilderByMenuSource(menuSource);
}

export function isDeliverectIntegratedVendor(
  vendor: Pick<VendorMenuSourceFields, "orderRoutingMode">
): boolean {
  return vendor.orderRoutingMode === "deliverect";
}

export function isSquareIntegratedVendor(
  vendor: Pick<VendorMenuSourceFields, "orderRoutingMode">
): boolean {
  return vendor.orderRoutingMode === "square";
}


export { isOpenOrderMenuSource, isDeliverectMenuSource };

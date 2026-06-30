import "server-only";

import { notFound, redirect } from "next/navigation";
import type { VendorMenuSource } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  isDeliverectMenuSource,
  isOpenOrderMenuSource,
  type VendorMenuSourceFields,
} from "@/lib/vendor-menu-source";

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

/** Redirect manual/open_order vendors away from Deliverect menu tooling. */
export function gateDeliverectMenuRoutes(vendor: Pick<VendorMenuSourceFields, "menuSource">, vendorId: string) {
  if (isOpenOrderMenuSource(vendor)) {
    redirect(`/vendor/${vendorId}/menu-builder?inactive_menu_source=deliverect`);
  }
}

/** Redirect Deliverect vendors away from Open Order Menu Builder editing. */
export function gateOpenOrderMenuBuilderRoutes(
  vendor: Pick<VendorMenuSourceFields, "menuSource">,
  vendorId: string
) {
  if (isDeliverectMenuSource(vendor)) {
    redirect(`/vendor/${vendorId}/menu?inactive_menu_source=open_order`);
  }
}

export function vendorUsesMenuBuilder(menuSource: VendorMenuSource): boolean {
  return menuSource === "open_order";
}

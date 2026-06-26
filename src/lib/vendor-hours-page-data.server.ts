import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/db";
import {
  defaultVendorCustomerOrderingWeek,
  parseVendorCustomerOrderingWeek,
  type VendorCustomerOrderingWeek,
} from "@/lib/vendor-customer-ordering-hours";

export type VendorHoursPageData = {
  vendorId: string;
  vendorName: string;
  customHours: VendorCustomerOrderingWeek;
};

export const loadVendorHoursPageData = cache(async (vendorId: string): Promise<VendorHoursPageData | null> => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      id: true,
      name: true,
      customerOrderingHours: true,
    },
  });
  if (!vendor) return null;

  const parsedCustom =
    parseVendorCustomerOrderingWeek(vendor.customerOrderingHours) ?? defaultVendorCustomerOrderingWeek();

  return {
    vendorId: vendor.id,
    vendorName: vendor.name,
    customHours: parsedCustom,
  };
});

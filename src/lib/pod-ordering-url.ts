/** Query param for on-site QR / printed code entry (MVP). */
export const POD_QR_ENTRY_PARAM = "entry" as const;
export const POD_QR_ENTRY_VALUE = "qr" as const;

export {
  buildPodCustomerPath as buildPodPagePath,
  buildPodOrderingAbsoluteUrl,
  buildVendorMenuCustomerPath,
} from "@/lib/customer-public-url";

import { OPEN_ORDER_SUPPORT_EMAIL } from "@/lib/legal/constants";

export const HOME_HERO_HEADLINE = "One ordering system for the whole food pod.";

export const HOME_HERO_SUPPORTING =
  "Food pods bring people together. Ordering often pulls them apart. Open Order lets guests scan one QR code, order from multiple vendors, check out once, and track every pickup from one place.";

export const HOME_QR_FLOW_STEPS = [
  "Scan QR",
  "View pod",
  "Order from multiple vendors",
  "Pay once",
  "Track pickup",
] as const;

export const HOME_POD_OWNER_HEADLINE = "Make your food pod feel like one connected place.";

export const HOME_POD_OWNER_SUPPORTING =
  "Open Order gives your pod one shared ordering layer across independent vendors, helping guests order together, stay longer, and move through pickup without confusion.";

export const HOME_POD_OWNER_BENEFITS = [
  "One connected guest experience",
  "Multi-vendor ordering without making the pod feel fragmented",
  "Better group ordering experience",
  "Less confusion around checkout and pickup",
  "Vendor-friendly operations",
] as const;

export const HOME_PRIMARY_CTA_LABEL = "Bring Open Order to your pod";

export const HOME_SECONDARY_CTA_LABEL = "Explore participating pods";

export const HOME_POD_INQUIRY_SUBJECT = "Bring Open Order to my pod";

export const HOME_CONTACT_SUBJECT = "Open Order pod inquiry";

export function homePodOwnerMailtoHref(subject = HOME_POD_INQUIRY_SUBJECT): string {
  return `mailto:${OPEN_ORDER_SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

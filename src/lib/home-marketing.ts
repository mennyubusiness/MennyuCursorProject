import { OPEN_ORDER_SUPPORT_EMAIL } from "@/lib/legal/constants";

export const HOME_HERO_HEADLINE = "One ordering system for the whole food pod.";

export const HOME_HERO_SUPPORTING =
  "Guests order from multiple vendors in one checkout, track every kitchen from one status page, and stay connected with the people they came with.";

export const HOME_PRIMARY_CTA_LABEL = "Bring Open Order to your pod";

export const HOME_SECONDARY_CTA_LABEL = "Explore participating pods";

export const HOME_POD_INQUIRY_SUBJECT = "Bring Open Order to my pod";

export const HOME_CONTACT_SUBJECT = "Open Order pod inquiry";

export function homePodOwnerMailtoHref(subject = HOME_POD_INQUIRY_SUBJECT): string {
  return `mailto:${OPEN_ORDER_SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

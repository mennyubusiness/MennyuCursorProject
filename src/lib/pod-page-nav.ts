import type { PodPageNavItem } from "@/components/pod/PodPageStickyNav";

export type PodPageNavContext = {
  hasAboutSection: boolean;
  hasLocationSection: boolean;
  hasContactSection: boolean;
};

export function buildPodPageNavItems(ctx: PodPageNavContext): PodPageNavItem[] {
  const items: PodPageNavItem[] = [{ id: "pod-vendors", label: "Vendors" }];

  if (ctx.hasAboutSection) {
    items.push({ id: "pod-about", label: "About" });
  }
  if (ctx.hasLocationSection) {
    items.push({ id: "pod-location", label: "Location" });
  }
  if (ctx.hasContactSection) {
    items.push({ id: "pod-contact", label: "Contact" });
  }

  return items;
}

export function buildDestinationPodNavItems(ctx: {
  hasAboutSection: boolean;
  hasVisitSection: boolean;
  hasGroupOrderSection: boolean;
}): PodPageNavItem[] {
  const items: PodPageNavItem[] = [{ id: "pod-vendors", label: "Order" }];

  if (ctx.hasGroupOrderSection) {
    items.push({ id: "pod-group-order", label: "Group" });
  }
  if (ctx.hasAboutSection) {
    items.push({ id: "pod-about", label: "About" });
  }
  if (ctx.hasVisitSection) {
    items.push({ id: "pod-visit", label: "Visit" });
  }

  return items;
}

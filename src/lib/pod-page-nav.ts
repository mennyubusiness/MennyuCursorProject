import type { PodPageNavItem } from "@/components/pod/PodPageStickyNav";

export type PodPageNavContext = {
  hasAboutSection: boolean;
  hasLocationSection: boolean;
  hasContactSection: boolean;
  showGroupOrderNav: boolean;
};

export function buildPodPageNavItems(ctx: PodPageNavContext): PodPageNavItem[] {
  const items: PodPageNavItem[] = [{ id: "pod-vendors", label: "Vendors" }];

  if (ctx.showGroupOrderNav) {
    items.push({ id: "pod-group-order", label: "Group Order" });
  }
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

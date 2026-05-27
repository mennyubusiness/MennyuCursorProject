import type { CustomerVendorMenuCategorySection } from "@/services/vendor-customer-menu.service";

const SPOTLIGHT_SECTION_NAME =
  /featured|popular|most\s*ordered|bestseller|recommended|favorites?/i;

export function isSpotlightMenuSection(section: { name: string }): boolean {
  return SPOTLIGHT_SECTION_NAME.test(section.name.trim());
}

export function partitionMenuSections(sections: CustomerVendorMenuCategorySection[]): {
  spotlightSections: CustomerVendorMenuCategorySection[];
  mainSections: CustomerVendorMenuCategorySection[];
} {
  const spotlightSections = sections.filter(isSpotlightMenuSection);
  if (spotlightSections.length === 0) {
    return { spotlightSections: [], mainSections: sections };
  }
  const spotlightIds = new Set(spotlightSections.map((s) => s.id));
  const mainSections = sections.filter((s) => !spotlightIds.has(s.id));
  return { spotlightSections, mainSections };
}

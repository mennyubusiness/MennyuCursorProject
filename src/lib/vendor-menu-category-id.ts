/** HTML-safe fragment id for menu category anchors (client + server). */
export function customerMenuCategoryDomId(sectionId: string): string {
  return `menu-cat-${sectionId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

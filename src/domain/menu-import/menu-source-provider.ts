/**
 * Generic menu source provider derived from canonical `sourcePayloadKind`.
 * Phase 1: read-only helper; snapshot JSON still stores kind under `menu.deliverect`.
 */

export type MenuSourceProvider = "deliverect" | "square" | "open_order" | "unknown";

export function menuSourceProvider(
  sourcePayloadKind: string | null | undefined
): MenuSourceProvider {
  const kind = sourcePayloadKind?.trim() ?? "";
  if (kind === "square_catalog_v1") return "square";
  if (kind === "open_order_builder_v1") return "open_order";
  if (kind === "deliverect_menu_api_v1" || kind === "deliverect_menu_webhook_v1") return "deliverect";
  return "unknown";
}

export function menuSourceProviderLabel(provider: MenuSourceProvider): string {
  switch (provider) {
    case "square":
      return "Square";
    case "open_order":
      return "Open Order";
    case "deliverect":
      return "Deliverect";
    default:
      return "Menu source";
  }
}

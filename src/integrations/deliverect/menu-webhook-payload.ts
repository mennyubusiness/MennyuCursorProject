/**
 * Best-effort extraction of Deliverect correlation fields from Menu Update webhook JSON.
 * Shapes vary by product version — treat as optional hints for `DeliverectMenuImportMeta`.
 */
import { nonEmptyStringField } from "@/integrations/deliverect/webhook-inbound-shared";

function readFromObjects(keys: string[], objects: Array<Record<string, unknown> | undefined>): string | undefined {
  for (const obj of objects) {
    if (!obj) continue;
    for (const k of keys) {
      const s = nonEmptyStringField(obj[k]);
      if (s) return s;
    }
  }
  return undefined;
}

export function extractMenuWebhookLocationId(parsed: Record<string, unknown>): string | undefined {
  const data = parsed.data as Record<string, unknown> | undefined;
  const loc = parsed.location;
  const locObj = loc && typeof loc === "object" && !Array.isArray(loc) ? (loc as Record<string, unknown>) : undefined;
  return readFromObjects(
    ["locationId", "location_id", "_id", "id"],
    [parsed, data, parsed.payload as Record<string, unknown> | undefined, locObj]
  );
}

export function extractMenuWebhookMenuId(parsed: Record<string, unknown>): string | undefined {
  const data = parsed.data as Record<string, unknown> | undefined;
  const menu = parsed.menu;
  const menuObj =
    menu && typeof menu === "object" && !Array.isArray(menu) ? (menu as Record<string, unknown>) : undefined;
  return readFromObjects(
    ["menuId", "menu_id", "_id", "id"],
    [parsed, data, parsed.payload as Record<string, unknown> | undefined, menuObj]
  );
}

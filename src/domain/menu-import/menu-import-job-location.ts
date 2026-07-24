/**
 * MenuImportJob source location dual-write helpers (Phase 2).
 * Square must never write `deliverectLocationId` on new rows.
 */
import type { MenuImportSource } from "@prisma/client";

export type MenuImportJobLocationWrite = {
  sourceLocationId: string | null;
  /** Only set for Deliverect (and other legacy) sources during transition. Square: always null. */
  deliverectLocationId: string | null;
};

/**
 * Build location columns for a new MenuImportJob.
 * - Square: `sourceLocationId` only
 * - Deliverect: dual-write `sourceLocationId` + `deliverectLocationId`
 * - Unknown: write `sourceLocationId` only (do not invent Deliverect columns)
 */
export function menuImportJobLocationWrite(input: {
  source: MenuImportSource | string;
  locationId: string | null | undefined;
}): MenuImportJobLocationWrite {
  const locationId = input.locationId?.trim() || null;
  const source = String(input.source);
  const isDeliverect =
    source === "DELIVERECT_API_PULL" || source === "DELIVERECT_MENU_WEBHOOK";
  const isSquare = source === "SQUARE_CATALOG_PULL";

  if (isSquare) {
    return { sourceLocationId: locationId, deliverectLocationId: null };
  }
  if (isDeliverect) {
    return { sourceLocationId: locationId, deliverectLocationId: locationId };
  }
  return { sourceLocationId: locationId, deliverectLocationId: null };
}

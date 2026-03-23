/**
 * Hook after a menu import draft is successfully published to live tables.
 * Placeholder for Deliverect "Menu Update Callback (Async)" or similar — notify external systems
 * only after live MenuItem/Modifier* rows match the published MenuVersion snapshot.
 */
import "server-only";
import type { MenuImportSource } from "@prisma/client";

export type MenuImportPublishedPayload = {
  jobId: string;
  vendorId: string;
  menuVersionId: string;
  source: MenuImportSource;
  publishedBy: string | null;
};

export async function onMenuImportPublishedToLive(payload: MenuImportPublishedPayload): Promise<void> {
  // V1: explicit no-op; wire Deliverect callback URL when contract is fixed.
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console -- intentional audit trail in dev
    console.info("[menu-import] published to live (Deliverect callback hook placeholder)", {
      jobId: payload.jobId,
      vendorId: payload.vendorId,
      menuVersionId: payload.menuVersionId,
      source: payload.source,
      publishedBy: payload.publishedBy,
    });
  }
}

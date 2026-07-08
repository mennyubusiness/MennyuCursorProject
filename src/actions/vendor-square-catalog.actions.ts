"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { canManageVendor } from "@/lib/permissions";
import {
  importSquareCatalog,
  previewSquareCatalogImport,
  SquareCatalogImportError,
} from "@/lib/integrations/square/square-menu-import.service";

async function assertVendorManager(vendorId: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false as const, error: "Not signed in." };
  if (!(await canManageVendor(userId, vendorId))) {
    return { ok: false as const, error: "You don’t have permission to manage this vendor." };
  }
  return { ok: true as const, userId };
}

export async function previewSquareCatalogAction(vendorId: string) {
  const gate = await assertVendorManager(vendorId);
  if (!gate.ok) return gate;
  try {
    const report = await previewSquareCatalogImport(vendorId);
    return { ok: true as const, report };
  } catch (e) {
    const message =
      e instanceof SquareCatalogImportError
        ? e.message
        : e instanceof Error
          ? e.message
          : "Preview failed.";
    return { ok: false as const, error: message };
  }
}

export async function importSquareCatalogAction(vendorId: string) {
  const gate = await assertVendorManager(vendorId);
  if (!gate.ok) return gate;
  try {
    const report = await importSquareCatalog(vendorId, gate.userId);
    revalidatePath(`/vendor/${vendorId}/integrations/square`);
    revalidatePath(`/vendor/${vendorId}/menu/imports`);
    revalidatePath(`/vendor/${vendorId}/menu-imports`);
    revalidatePath(`/vendor/${vendorId}/menu-imports/${report.jobId}`);
    return { ok: true as const, report };
  } catch (e) {
    const message =
      e instanceof SquareCatalogImportError
        ? e.message
        : e instanceof Error
          ? e.message
          : "Import failed.";
    return { ok: false as const, error: message };
  }
}

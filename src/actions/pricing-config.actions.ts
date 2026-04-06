"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

function clampBps(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(10_000, Math.round(n));
}

function clampNonNegInt(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

/**
 * Percent input like 3.5 for 3.5% → 350 bps.
 */
function percentToBps(percent: number): number {
  return clampBps(Math.round(percent * 100));
}

export type PricingConfigFormInput = {
  customerServiceFeePercent: number;
  customerServiceFeeFlatCents: number;
  vendorProcessingFeePercent: number;
  vendorProcessingFeeFlatCents: number;
  notes?: string;
};

export async function updateActivePricingConfig(
  input: PricingConfigFormInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const customerServiceFeeBps = percentToBps(input.customerServiceFeePercent);
  const vendorProcessingFeeBps = percentToBps(input.vendorProcessingFeePercent);
  const customerServiceFeeFlatCents = clampNonNegInt(input.customerServiceFeeFlatCents);
  const vendorProcessingFeeFlatCents = clampNonNegInt(input.vendorProcessingFeeFlatCents);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.pricingConfig.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
      await tx.pricingConfig.create({
        data: {
          customerServiceFeeBps,
          customerServiceFeeFlatCents,
          vendorProcessingFeeBps,
          vendorProcessingFeeFlatCents,
          isActive: true,
          effectiveAt: new Date(),
          notes: input.notes?.trim() || null,
        },
      });
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
  revalidatePath("/admin/pricing");
  return { ok: true };
}

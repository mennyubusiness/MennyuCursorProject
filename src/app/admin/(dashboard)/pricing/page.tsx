import { prisma } from "@/lib/db";
import { getActivePricingConfigRow } from "@/services/pricing-config.service";
import { AdminPricingForm } from "./AdminPricingForm";

function bpsToPercentNumber(bps: number): number {
  return Math.round((bps / 100) * 100) / 100;
}

export default async function AdminPricingPage() {
  const active = await getActivePricingConfigRow();
  const history = await prisma.pricingConfig.findMany({
    orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
    take: 8,
    select: {
      id: true,
      effectiveAt: true,
      isActive: true,
      customerServiceFeeBps: true,
      vendorProcessingFeeBps: true,
      notes: true,
    },
  });

  const initial = active
    ? {
        customerServiceFeePercent: bpsToPercentNumber(active.customerServiceFeeBps),
        customerServiceFeeFlatCents: active.customerServiceFeeFlatCents,
        vendorProcessingFeePercent: bpsToPercentNumber(active.vendorProcessingFeeBps),
        vendorProcessingFeeFlatCents: active.vendorProcessingFeeFlatCents,
      }
    : {
        customerServiceFeePercent: 3.5,
        customerServiceFeeFlatCents: 0,
        vendorProcessingFeePercent: 2.75,
        vendorProcessingFeeFlatCents: 0,
      };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Pricing</h1>
        <p className="mt-1 text-sm text-stone-500">
          Global checkout rates. Changes apply to <strong>new orders only</strong>; existing orders keep
          their snapshots.
        </p>
      </div>

      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-stone-900">Active configuration</h2>
        {active ? (
          <p className="mt-1 text-xs text-stone-500">
            Effective {active.effectiveAt.toISOString().slice(0, 19)}Z · id <code className="text-[11px]">{active.id}</code>
          </p>
        ) : (
          <p className="mt-1 text-sm text-amber-800">No active row — seed migration may be missing.</p>
        )}
        <div className="mt-4">
          <AdminPricingForm initial={initial} />
        </div>
      </section>

      <section className="rounded-lg border border-stone-200 bg-stone-50/50 p-4">
        <h2 className="text-sm font-semibold text-stone-900">Recent versions</h2>
        <ul className="mt-2 space-y-2 text-xs text-stone-700">
          {history.map((h) => (
            <li
              key={h.id}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded border border-stone-100 bg-white px-2 py-1.5"
            >
              <span>
                {h.isActive ? (
                  <span className="font-medium text-emerald-800">active</span>
                ) : (
                  <span className="text-stone-400">inactive</span>
                )}{" "}
                · CS {bpsToPercentNumber(h.customerServiceFeeBps)}% · vendor {bpsToPercentNumber(h.vendorProcessingFeeBps)}%
              </span>
              <span className="text-stone-500">{h.effectiveAt.toISOString().slice(0, 19)}Z</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

import type { GroupOrderCartReadModel } from "@/lib/group-order-cart-read-model";
import { findParticipantRow, GROUP_ORDER_CHECKOUT_DEFAULT_TIP_PREVIEW_PERCENT } from "@/lib/group-order-cart-read-model";

export function ParticipantGroupOrderSummary({
  model,
  viewerParticipantId,
}: {
  model: GroupOrderCartReadModel;
  viewerParticipantId: string;
}) {
  const row = findParticipantRow(model, viewerParticipantId);
  if (!row) return null;

  return (
    <div className="rounded-2xl border-2 border-stone-200/90 bg-gradient-to-b from-white to-stone-50/90 p-6 shadow-sm sm:p-8">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Your part</h2>
      <p className="mt-2 text-sm text-stone-600">
        The host completes payment for everyone. You won&apos;t see the full order total — only your own food and
        your share of the tip (example below).
      </p>
      <dl className="mt-5 space-y-3">
        <div className="flex items-baseline justify-between gap-4 border-b border-stone-100 pb-3">
          <dt className="text-base text-stone-700">Your food</dt>
          <dd className="text-xl font-bold tabular-nums text-stone-900">${(row.subtotalCents / 100).toFixed(2)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-b border-stone-100 pb-3">
          <dt className="text-base text-stone-700">Example tip share</dt>
          <dd className="text-lg font-semibold tabular-nums text-stone-800">
            ${(row.illustrativeTipShareCents / 100).toFixed(2)}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-stone-500">
        Example tip share assumes the host keeps the default {GROUP_ORDER_CHECKOUT_DEFAULT_TIP_PREVIEW_PERCENT}% tip on
        the whole order at checkout. Tax and service fee apply to the full order and are paid by the host.
      </p>
    </div>
  );
}

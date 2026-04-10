import type { GroupOrderCartReadModel } from "@/lib/group-order-cart-read-model";
import { GROUP_ORDER_CHECKOUT_DEFAULT_TIP_PREVIEW_PERCENT } from "@/lib/group-order-cart-read-model";

export function HostParticipantBreakdown({ model }: { model: GroupOrderCartReadModel }) {
  return (
    <details className="mt-4 rounded-xl border border-stone-200 bg-stone-50/90 p-3 text-sm">
      <summary className="cursor-pointer font-medium text-stone-800">
        Participant breakdown (food + example tip share)
      </summary>
      <p className="mt-2 text-xs text-stone-600">
        Tip share uses the same pro-rata rule as the full order: your share of the total tip matches your share
        of food. Example amounts assume the host keeps the default {GROUP_ORDER_CHECKOUT_DEFAULT_TIP_PREVIEW_PERCENT}%
        tip at checkout — the host may change this before paying.
      </p>
      <table className="mt-3 w-full text-left text-xs">
        <thead>
          <tr className="border-b border-stone-200 text-stone-500">
            <th className="py-1.5 pr-2 font-medium">Participant</th>
            <th className="py-1.5 pr-2 font-medium tabular-nums">Food</th>
            <th className="py-1.5 font-medium tabular-nums">Est. tip share</th>
          </tr>
        </thead>
        <tbody>
          {model.participantRows.map((row) => (
            <tr key={row.participantId} className="border-b border-stone-100/80 text-stone-800">
              <td className="py-2 pr-2">
                {row.displayName}
                {row.isHost ? <span className="text-stone-500"> · host</span> : null}
              </td>
              <td className="py-2 pr-2 tabular-nums">${(row.subtotalCents / 100).toFixed(2)}</td>
              <td className="py-2 tabular-nums">${(row.illustrativeTipShareCents / 100).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-stone-500">
        Items in the list above are labeled so you can see who ordered what. Full tax, service fee, and payment
        total are shown in your order summary — only you see those as host.
      </p>
    </details>
  );
}

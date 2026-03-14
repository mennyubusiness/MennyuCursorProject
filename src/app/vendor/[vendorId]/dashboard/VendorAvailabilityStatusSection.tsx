/**
 * Shows POS vs Mennyu availability state so vendors see both clearly.
 * Store status: from POS/Deliverect (open/closed). Mennyu orders: from pause toggle.
 */

export function VendorAvailabilityStatusSection({
  posOpen,
  mennyuOrdersPaused,
}: {
  /** When false, store is closed (from POS). When undefined, not yet connected. */
  posOpen?: boolean;
  mennyuOrdersPaused: boolean;
}) {
  const storeStatus = posOpen === false ? "Closed" : "Open";
  const mennyuStatus = mennyuOrdersPaused ? "Paused" : "Active";

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-medium text-stone-500">Status</h2>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-stone-600">Store (from POS)</dt>
          <dd className="font-medium text-stone-900">{storeStatus}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-stone-600">Mennyu orders</dt>
          <dd className="font-medium text-stone-900">{mennyuStatus}</dd>
        </div>
      </dl>
    </div>
  );
}

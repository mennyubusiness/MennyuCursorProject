"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminRunTransferReversalBatchAction } from "@/actions/admin-payout-transfer-reversal.actions";

export function TransferReversalBatchPanel() {
  const router = useRouter();
  const [batchKey, setBatchKey] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runBatch() {
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const r = await adminRunTransferReversalBatchAction(batchKey.trim() || undefined);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setResult(JSON.stringify(r.summary, null, 2));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Batch failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4">
      <h2 className="text-sm font-semibold text-stone-900">Transfer reversals (refund-linked)</h2>
      <p className="mt-1 text-xs text-stone-600">
        Processes <code className="rounded bg-white px-1">pending</code> rows created after full refunds. Pulls funds back
        from connected accounts via Stripe transfer reversals (separate from the customer refund). Failures stay visible on
        each row.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-stone-600">
          Batch key (optional, default UTC date)
          <input
            type="text"
            value={batchKey}
            onChange={(e) => setBatchKey(e.target.value)}
            placeholder="2026-04-06"
            className="rounded border border-stone-300 px-2 py-1 font-mono text-sm text-stone-900"
          />
        </label>
        <button
          type="button"
          onClick={() => void runBatch()}
          disabled={pending}
          className="rounded-lg bg-amber-900 px-4 py-2 text-sm font-medium text-white hover:bg-amber-950 disabled:opacity-50"
        >
          {pending ? "Running…" : "Run reversal batch"}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {result && (
        <pre className="mt-3 max-h-64 overflow-auto rounded border border-amber-200 bg-white p-3 text-xs text-stone-800">
          {result}
        </pre>
      )}
    </div>
  );
}

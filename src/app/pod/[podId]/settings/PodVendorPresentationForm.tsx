"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updatePodVendorPresentation } from "@/actions/pod-settings.actions";

export type PodVendorPresentationRowState = {
  vendorId: string;
  vendorName: string;
  isFeatured: boolean;
};

export function PodVendorPresentationForm({
  podId,
  initialRows,
}: {
  podId: string;
  initialRows: PodVendorPresentationRowState[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  function move(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= rows.length) return;
    setRows((prev) => {
      const copy = [...prev];
      const t = copy[index]!;
      copy[index] = copy[next]!;
      copy[next] = t;
      return copy;
    });
  }

  function setFeatured(index: number, featured: boolean) {
    setRows((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index]!, isFeatured: featured };
      return copy;
    });
  }

  async function onSave() {
    setMessage(null);
    startTransition(async () => {
      const res = await updatePodVendorPresentation(
        podId,
        rows.map((r) => ({ vendorId: r.vendorId, isFeatured: r.isFeatured }))
      );
      if (!res.ok) {
        setMessage({ text: res.error ?? "Could not save", error: true });
        return;
      }
      setMessage({ text: "Saved.", error: false });
      router.refresh();
    });
  }

  if (rows.length === 0) {
    return <p className="text-sm text-stone-500">No vendors in this pod yet.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-600">
        <strong>Order</strong> is top-to-bottom on the customer pod page. <strong>Featured</strong> vendors
        appear first (in the order you set), then everyone else (in order).
      </p>
      <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
        {rows.map((row, index) => (
          <li key={row.vendorId} className="flex flex-wrap items-center gap-3 px-3 py-3 sm:flex-nowrap">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-stone-900">{row.vendorName}</p>
              <p className="font-mono text-xs text-stone-400">{row.vendorId.slice(-8)}</p>
            </div>
            <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={row.isFeatured}
                onChange={(e) => setFeatured(index, e.target.checked)}
                className="rounded border-stone-300"
              />
              Featured
            </label>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => move(index, -1)}
                className="rounded border border-stone-300 bg-white px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-40"
              >
                Up
              </button>
              <button
                type="button"
                disabled={index === rows.length - 1}
                onClick={() => move(index, 1)}
                className="rounded border border-stone-300 bg-white px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-40"
              >
                Down
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => void onSave()}
          className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save presentation"}
        </button>
        {message && (
          <span className={`text-sm ${message.error ? "text-red-600" : "text-emerald-800"}`} role="status">
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}

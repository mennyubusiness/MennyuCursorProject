"use client";

import type { VendorStageKey } from "./customer-order-progress";

const SEGMENTS: { key: VendorStageKey; label: string }[] = [
  { key: "received", label: "Received" },
  { key: "confirmed", label: "Confirmed" },
  { key: "kitchen", label: "Preparing" },
  { key: "ready", label: "Ready" },
  { key: "done", label: "Done" },
];

function activeIndex(stage: VendorStageKey): number {
  if (stage === "stopped") return -1;
  if (stage === "done") return 4;
  if (stage === "ready") return 3;
  if (stage === "kitchen") return 2;
  if (stage === "confirmed") return 1;
  return 0;
}

export function VendorCustomerStatusStrip({ stage }: { stage: VendorStageKey }) {
  if (stage === "stopped") {
    return (
      <p className="mt-2 text-xs text-stone-500">This part of the order did not go through.</p>
    );
  }

  if (stage === "done") {
    return null;
  }

  const idx = activeIndex(stage);
  const currentLabel = SEGMENTS[idx]?.label ?? "Received";

  return (
    <div className="mt-2.5" role="group" aria-label="Vendor progress">
      <div className="flex items-center gap-1">
        {SEGMENTS.map((seg, i) => {
          const complete = idx >= 0 && i < idx;
          const current = i === idx;
          return (
            <div
              key={seg.key}
              className={`h-1 flex-1 rounded-full ${
                complete ? "bg-stone-800" : current ? "bg-stone-500" : "bg-stone-200"
              }`}
              aria-hidden
            />
          );
        })}
      </div>
      <p className="mt-1.5 text-xs text-stone-500">
        Step {idx + 1} of {SEGMENTS.length}: {currentLabel}
      </p>
    </div>
  );
}

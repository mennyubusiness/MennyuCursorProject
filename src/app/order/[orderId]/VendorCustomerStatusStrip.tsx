"use client";

import type { VendorStageKey } from "./customer-order-progress";

const SEGMENTS: { key: VendorStageKey; label: string }[] = [
  { key: "confirming", label: "Confirming" },
  { key: "kitchen", label: "Kitchen" },
  { key: "ready", label: "Ready" },
  { key: "done", label: "Done" },
];

function activeIndex(stage: VendorStageKey): number {
  if (stage === "stopped") return -1;
  if (stage === "done") return 3;
  if (stage === "ready") return 2;
  if (stage === "kitchen") return 1;
  return 0;
}

export function VendorCustomerStatusStrip({ stage }: { stage: VendorStageKey }) {
  if (stage === "stopped") {
    return (
      <p className="mt-2 text-xs font-medium text-stone-500">This part of the order did not go through.</p>
    );
  }

  const idx = activeIndex(stage);
  return (
    <div className="mt-3" role="group" aria-label="Vendor progress">
      <div className="grid grid-cols-4 gap-1 rounded-lg bg-stone-100/90 p-1">
        {SEGMENTS.map((seg, i) => {
          const complete = stage === "done" || (idx >= 0 && i < idx);
          const current = stage !== "done" && i === idx;
          return (
            <div
              key={seg.key}
              className={`rounded-md px-1 py-1.5 text-center text-[10px] font-semibold leading-tight sm:text-xs ${
                complete
                  ? "bg-mennyu-primary/90 text-black"
                  : current
                    ? "bg-white text-stone-900 shadow-sm ring-1 ring-mennyu-primary/40"
                    : "text-stone-400"
              }`}
            >
              {seg.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

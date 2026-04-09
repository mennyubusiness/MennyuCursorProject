"use client";

import type { ParentProgressStep } from "./customer-order-progress";

function circleClass(state: ParentProgressStep["state"]): string {
  switch (state) {
    case "complete":
      return "border-mennyu-primary bg-mennyu-primary text-black";
    case "current":
      return "border-mennyu-primary bg-white text-stone-900 shadow-sm ring-2 ring-mennyu-primary/35";
    case "danger":
      return "border-red-400 bg-red-50 text-red-800";
    case "skipped":
      return "border-stone-200 bg-stone-100 text-stone-400";
    default:
      return "border-stone-200 bg-white text-stone-400";
  }
}

function lineClass(active: boolean): string {
  return active ? "bg-mennyu-primary/60" : "bg-stone-200";
}

export function CustomerOrderProgressTimeline({ steps }: { steps: ParentProgressStep[] }) {
  const n = steps.length;
  return (
    <div className="w-full" role="list" aria-label="Order progress">
      <ol className="flex w-full list-none items-start justify-between gap-0 p-0">
        {steps.map((step, i) => {
          const prev = i > 0 ? steps[i - 1] : null;
          const next = i < n - 1 ? steps[i + 1] : null;
          const lineInActive =
            prev != null &&
            (prev.state === "complete" || prev.state === "current" || prev.state === "danger");
          const lineOutActive =
            next != null &&
            (step.state === "complete" || step.state === "current" || step.state === "danger");

          return (
            <li key={step.key} className="flex min-w-0 flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <div
                  className={`h-0.5 min-h-[2px] flex-1 ${i === 0 ? "opacity-0 sm:opacity-100" : ""} ${lineClass(lineInActive)}`}
                  aria-hidden
                />
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${circleClass(step.state)}`}
                  title={step.label || step.shortLabel}
                  role="listitem"
                >
                  {step.state === "complete" ? "✓" : step.state === "skipped" ? "·" : i + 1}
                </div>
                <div
                  className={`h-0.5 min-h-[2px] flex-1 ${i === n - 1 ? "opacity-0 sm:opacity-100" : ""} ${lineClass(lineOutActive)}`}
                  aria-hidden
                />
              </div>
              <p
                className={`mt-2 max-w-[4.5rem] text-center text-[10px] font-medium leading-tight sm:max-w-[6rem] sm:text-xs ${
                  step.state === "danger"
                    ? "text-red-800"
                    : step.state === "skipped"
                      ? "text-stone-300"
                      : step.state === "current"
                        ? "text-stone-900"
                        : "text-stone-600"
                }`}
              >
                {step.shortLabel}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

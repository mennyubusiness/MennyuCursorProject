"use client";

export type MenuBuilderGlobalSaveStatus = "idle" | "saving" | "saved" | "error";

export function MenuBuilderSaveStatus({ status }: { status: MenuBuilderGlobalSaveStatus }) {
  if (status === "idle") return null;

  const copy =
    status === "saving"
      ? "Saving…"
      : status === "saved"
        ? "All changes saved"
        : "Some changes failed";

  const cls =
    status === "error"
      ? "border-red-200 bg-red-50 text-red-900"
      : status === "saving"
        ? "border-sky-200 bg-sky-50 text-sky-900"
        : "border-emerald-200 bg-emerald-50 text-emerald-900";

  return (
    <p
      className={`rounded-lg border px-3 py-2 text-sm ${cls}`}
      role="status"
      aria-live="polite"
    >
      {copy}
    </p>
  );
}

"use client";

import { useSearchParams } from "next/navigation";

const INACTIVE_MENU_BUILDER_COPY = {
  title: "Menu Builder is inactive",
  body: "This location uses Deliverect menu sync for menus. Your Menu Builder data is saved and will return if routing switches back to the Open Order dashboard.",
} as const;

export function VendorInactiveMenuSourceNotice() {
  const sp = useSearchParams();
  if (sp.get("inactive_menu_source") !== "open_order") return null;

  const row = INACTIVE_MENU_BUILDER_COPY;

  return (
    <div
      className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      role="status"
    >
      <p className="font-medium">{row.title}</p>
      <p className="mt-1">{row.body}</p>
    </div>
  );
}

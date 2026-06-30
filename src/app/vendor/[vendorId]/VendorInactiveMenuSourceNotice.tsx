"use client";

import { useSearchParams } from "next/navigation";

const COPY = {
  deliverect: {
    title: "Deliverect menu sync is inactive",
    body: "This location uses the Open Order Menu Builder for menus. Your Deliverect menu data is saved and will return if routing switches back to Deliverect.",
  },
  open_order: {
    title: "Menu Builder is inactive",
    body: "This location uses Deliverect menu sync for menus. Your Menu Builder data is saved and will return if routing switches back to the Open Order dashboard.",
  },
} as const;

export function VendorInactiveMenuSourceNotice() {
  const sp = useSearchParams();
  const code = sp.get("inactive_menu_source");
  if (code !== "deliverect" && code !== "open_order") return null;

  const row = COPY[code];

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

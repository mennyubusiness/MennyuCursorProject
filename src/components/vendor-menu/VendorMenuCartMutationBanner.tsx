"use client";

import { useVendorMenuCart } from "@/components/vendor-menu/VendorMenuCartContext";

/** Shown below the site header when a background cart mutation fails (e.g. modifier add). */
export function VendorMenuCartMutationBanner() {
  const { cartMutationError, clearCartMutationError } = useVendorMenuCart();

  if (!cartMutationError) return null;

  return (
    <div
      role="alert"
      className="sticky top-16 z-30 border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 shadow-sm"
    >
      <div className="oo-shell flex items-start justify-between gap-3">
        <p className="min-w-0 font-medium">{cartMutationError.message}</p>
        <button
          type="button"
          onClick={clearCartMutationError}
          className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-red-800 underline-offset-2 hover:underline"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

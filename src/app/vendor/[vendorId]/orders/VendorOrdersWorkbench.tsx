"use client";

import { Suspense } from "react";
import { VendorOrdersLedger } from "./VendorOrdersLedger";

function VendorOrdersLedgerFallback() {
  return <p className="text-sm text-oo-stone-gray">Loading orders…</p>;
}

export function VendorOrdersWorkbench(
  props: Parameters<typeof VendorOrdersLedger>[0]
) {
  return (
    <Suspense fallback={<VendorOrdersLedgerFallback />}>
      <VendorOrdersLedger {...props} />
    </Suspense>
  );
}

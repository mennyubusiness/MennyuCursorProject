"use client";

import { useEffect, useRef } from "react";

/**
 * @deprecated Unused — legacy attempt to set mennyu_customer_phone for order lookup.
 * Order history requires a signed-in account; single-order access uses SMS signed links.
 */
export function SetCustomerPhoneFromOrder({ customerPhone }: { customerPhone: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !customerPhone?.trim()) return;
    done.current = true;
    fetch("/api/orders/set-phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: customerPhone.trim() }),
    }).catch(() => {});
  }, [customerPhone]);
  return null;
}

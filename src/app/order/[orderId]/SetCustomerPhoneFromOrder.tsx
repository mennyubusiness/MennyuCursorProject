"use client";

import { useEffect, useRef } from "react";

/**
 * When the customer views an order, set the customer-phone cookie so the order history page
 * can show their orders without re-entering the phone number.
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

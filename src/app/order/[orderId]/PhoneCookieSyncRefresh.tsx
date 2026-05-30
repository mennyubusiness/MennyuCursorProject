"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** @deprecated Unused — was paired with SetCustomerPhoneFromOrder for legacy cookie bootstrap. */
export function PhoneCookieSyncRefresh() {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => router.refresh(), 400);
    return () => clearTimeout(t);
  }, [router]);
  return null;
}

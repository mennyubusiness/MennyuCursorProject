"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** After SetCustomerPhoneFromOrder runs, refresh the server tree so resume payment can see the cookie. */
export function PhoneCookieSyncRefresh() {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => router.refresh(), 400);
    return () => clearTimeout(t);
  }, [router]);
  return null;
}

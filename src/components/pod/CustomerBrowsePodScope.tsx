"use client";

import { useEffect } from "react";

import { BROWSE_POD_ID_SESSION_KEY } from "@/lib/customer-browse-pod";

/** Keeps Quick Cart browse pod scope in sync on canonical slug customer routes. */
export function CustomerBrowsePodScope({ podId }: { podId: string }) {
  useEffect(() => {
    sessionStorage.setItem(BROWSE_POD_ID_SESSION_KEY, podId);
  }, [podId]);
  return null;
}

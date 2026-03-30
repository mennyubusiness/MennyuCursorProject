"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

/** Client: show feedback after magic-link grant redirect. */
export function VendorAccessQueryMessages() {
  const sp = useSearchParams();
  const code = sp.get("access");
  if (!code) return null;

  const copy: Record<string, { title: string; body: ReactNode; tone: "error" | "warn" }> = {
    invalid: {
      title: "Link invalid or expired",
      body: "Ask your Mennyu administrator for a new secure link, or sign in with email if you have an account.",
      tone: "error",
    },
    missing_token: {
      title: "Link incomplete",
      body: "Use the full URL you were sent (including everything after ?).",
      tone: "warn",
    },
    vendor_mismatch: {
      title: "Link doesn’t match this restaurant",
      body: "Open the link for this location, or contact support.",
      tone: "error",
    },
    no_secret: {
      title: "This location isn’t fully set up yet",
      body: "Your administrator still needs to finish setup. You can try again after they’ve sent a link or enabled sign-in.",
      tone: "warn",
    },
    needs_session: {
      title: "Please sign in to continue",
      body: (
        <>
          Use{" "}
          <Link href="/login?intent=vendor" className="font-medium text-sky-800 underline">
            Sign in
          </Link>{" "}
          or your admin secure link. Token access is under <strong>Advanced</strong> on Settings.
        </>
      ),
      tone: "warn",
    },
  };

  const row = copy[code];
  if (!row) return null;

  const cls =
    row.tone === "error"
      ? "border-red-200 bg-red-50 text-red-950"
      : "border-amber-200 bg-amber-50 text-amber-950";

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${cls}`} role="alert">
      <p className="font-medium">{row.title}</p>
      <p className="mt-1">{row.body}</p>
    </div>
  );
}

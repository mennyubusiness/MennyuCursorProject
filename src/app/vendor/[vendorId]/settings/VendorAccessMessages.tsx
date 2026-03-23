"use client";

import { useSearchParams } from "next/navigation";

/** Client: show feedback after magic-link grant redirect. */
export function VendorAccessQueryMessages() {
  const sp = useSearchParams();
  const code = sp.get("access");
  if (!code) return null;

  const copy: Record<string, { title: string; body: string; tone: "error" | "warn" }> = {
    invalid: {
      title: "Link invalid or expired",
      body: "Ask your Mennyu admin for a new secure access link.",
      tone: "error",
    },
    missing_token: {
      title: "Link incomplete",
      body: "Use the full URL from your admin (including the token parameter).",
      tone: "warn",
    },
    vendor_mismatch: {
      title: "Link does not match this vendor",
      body: "Open the link for your location, or ask Mennyu support.",
      tone: "error",
    },
    no_secret: {
      title: "Dashboard not ready yet",
      body: "Ask your Mennyu admin to provision access (secure link or token API).",
      tone: "warn",
    },
    needs_session: {
      title: "Finish signing in",
      body: "Open your secure access link, paste a legacy token under Manual token, or sign in at /login if you have a vendor account.",
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

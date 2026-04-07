"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PosConnectionStatus } from "@prisma/client";
import { saveVendorPosConnection } from "@/actions/vendor-pos.actions";
import { MennyuLocationIdField } from "@/components/vendor/MennyuLocationIdField";

const POS_BRANDS = [
  { id: "toast", label: "Toast" },
  { id: "square", label: "Square" },
  { id: "clover", label: "Clover" },
  { id: "lightspeed", label: "Lightspeed / K" },
  { id: "other", label: "Other" },
];

type VendorFields = {
  id: string;
  deliverectChannelLinkId: string | null;
  deliverectLocationId: string | null;
  deliverectAccountEmail: string | null;
  posProvider: string | null;
  posType: string | null;
  posConnectionStatus: PosConnectionStatus;
};

export function ConnectPosWizard({ vendor }: { vendor: VendorFields }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [posProvider, setPosProvider] = useState(vendor.posProvider ?? vendor.posType ?? "");
  const [channelLinkId, setChannelLinkId] = useState(vendor.deliverectChannelLinkId ?? "");
  const [locationId, setLocationId] = useState(vendor.deliverectLocationId ?? "");
  const [accountEmail, setAccountEmail] = useState(vendor.deliverectAccountEmail ?? "");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await saveVendorPosConnection({
        vendorId: vendor.id,
        deliverectChannelLinkId: channelLinkId.trim() || null,
        deliverectLocationId: locationId.trim() || null,
        deliverectAccountEmail: accountEmail.trim() || null,
        posProvider: posProvider.trim() || null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push(`/vendor/${vendor.id}/orders`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const ordersHref = `/vendor/${vendor.id}/orders`;

  return (
    <div className="space-y-6">
      <div className="flex gap-2 text-xs font-medium text-stone-500">
        <span className={step >= 0 ? "text-mennyu-primary" : ""}>1 · Overview</span>
        <span>→</span>
        <span className={step >= 1 ? "text-mennyu-primary" : ""}>2 · Setup</span>
        <span>→</span>
        <span className={step >= 2 ? "text-mennyu-primary" : ""}>3 · Details</span>
      </div>

      {step === 0 && (
        <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-stone-900">Send orders to your kitchen</h3>
          <p className="text-sm text-stone-600 leading-relaxed">
            Mennyu can route paid orders to the same system your kitchen already uses. We connect through a partner
            integration so your team keeps a single source of truth for tickets and prep.
          </p>
          <p className="text-sm font-medium text-stone-800">Works with many popular systems</p>
          <ul className="grid grid-cols-2 gap-2 text-sm text-stone-600 sm:grid-cols-3">
            {POS_BRANDS.map((b) => (
              <li key={b.id} className="rounded-md bg-stone-50 px-3 py-2">
                {b.label}
              </li>
            ))}
          </ul>
          <p className="text-xs text-stone-500">
            Exact availability depends on your POS and account — you’ll finish linking in a few steps.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white"
              onClick={() => setStep(1)}
            >
              Continue
            </button>
            <Link href={ordersHref} className="rounded-lg px-4 py-2 text-sm text-stone-600 hover:text-stone-900">
              Skip for now
            </Link>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-stone-900">Set up in your POS hub</h3>
          <ol className="list-decimal space-y-3 pl-5 text-sm text-stone-600 leading-relaxed">
            <li>Create or sign in to your POS hub account (the same place you manage menus and tickets).</li>
            <li>Connect your in-store POS inside that hub, if you haven’t already.</li>
            <li>
              When you’re ready, come back here and add the connection details so Mennyu can route orders to the right
              place.
            </li>
          </ol>
          <MennyuLocationIdField mennyuLocationId={vendor.id} className="mt-4" />
          <p className="text-xs text-stone-500">
            If you’re not ready yet, you can still use Mennyu — orders can be handled manually until you connect.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white"
              onClick={() => setStep(2)}
            >
              I’m ready to enter details
            </button>
            <button type="button" className="text-sm text-stone-600 hover:text-stone-900" onClick={() => setStep(0)}>
              Back
            </button>
            <Link href={ordersHref} className="text-sm text-stone-500 hover:text-stone-800">
              Skip for now
            </Link>
          </div>
        </div>
      )}

      {step === 2 && (
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-stone-900">Connection details</h3>
          <p className="text-sm text-stone-600">
            Add what you have today — you can update this later. The <strong>channel link ID</strong> is the main value
            Mennyu needs to send orders to your kitchen once your account is wired on our side.
          </p>

          <MennyuLocationIdField mennyuLocationId={vendor.id} />

          <label className="block text-sm">
            <span className="font-medium text-stone-800">POS system</span>
            <select
              value={posProvider}
              onChange={(e) => setPosProvider(e.target.value)}
              className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
            >
              <option value="">Select…</option>
              {POS_BRANDS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="font-medium text-stone-800">Channel link ID</span>
            <input
              value={channelLinkId}
              onChange={(e) => setChannelLinkId(e.target.value)}
              className="mt-1 w-full rounded border border-stone-300 px-3 py-2 font-mono text-sm"
              placeholder="From your POS hub / integration settings"
              autoComplete="off"
            />
            <span className="mt-1 block text-xs text-stone-500">Required for automated routing when your hub is linked.</span>
          </label>

          <label className="block text-sm">
            <span className="font-medium text-stone-800">Store / location ID (optional)</span>
            <input
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="mt-1 w-full rounded border border-stone-300 px-3 py-2 font-mono text-sm"
              placeholder="If your hub shows a separate location id"
              autoComplete="off"
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-stone-800">POS hub account email (optional)</span>
            <input
              type="email"
              value={accountEmail}
              onChange={(e) => setAccountEmail(e.target.value)}
              className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
              placeholder="The email you use to sign in to your POS hub"
              autoComplete="email"
            />
          </label>

          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {loading ? "Saving…" : "Save and return to orders"}
            </button>
            <button type="button" className="text-sm text-stone-600 hover:text-stone-900" onClick={() => setStep(1)}>
              Back
            </button>
            <Link href={ordersHref} className="text-sm text-stone-500 hover:text-stone-800">
              Cancel
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

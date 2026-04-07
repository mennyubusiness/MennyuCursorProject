"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PosConnectionStatus } from "@prisma/client";
import { saveVendorPosConnection, startDeliverectPosOnboarding } from "@/actions/vendor-pos.actions";
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
  pendingDeliverectConnectionKey: string | null;
  deliverectAutoMapLastOutcome: string | null;
  deliverectAutoMapLastDetail: string | null;
};

function ManualConnectionForm({
  vendor,
  onSaved,
}: {
  vendor: VendorFields;
  onSaved?: () => void;
}) {
  const router = useRouter();
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
      onSaved?.();
      router.push(`/vendor/${vendor.id}/orders`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="mt-4 space-y-4">
      <p className="text-xs text-stone-500">
        For support, testing, or when automatic linking isn’t available.{" "}
        <strong>Channel link ID</strong> is what Mennyu uses to route orders once your hub is live.
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
          placeholder="From integration settings (admin / support)"
          autoComplete="off"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-stone-800">Store / location ID (optional)</span>
        <input
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2 font-mono text-sm"
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
          autoComplete="email"
        />
      </label>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

export function ConnectPosWizard({ vendor }: { vendor: VendorFields }) {
  const router = useRouter();
  const ordersHref = `/vendor/${vendor.id}/orders`;

  const [step, setStep] = useState(() => {
    if (
      vendor.pendingDeliverectConnectionKey &&
      vendor.posConnectionStatus === "onboarding" &&
      !vendor.deliverectChannelLinkId
    ) {
      return 2;
    }
    return 0;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localPendingKey, setLocalPendingKey] = useState<string | null>(null);

  const [posProvider, setPosProvider] = useState(vendor.posProvider ?? vendor.posType ?? "");
  const [accountEmail, setAccountEmail] = useState(vendor.deliverectAccountEmail ?? "");

  const displayPendingKey = localPendingKey ?? vendor.pendingDeliverectConnectionKey ?? null;

  if (vendor.deliverectChannelLinkId?.trim()) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 p-5 shadow-sm">
          <h3 className="text-base font-semibold text-emerald-950">Your POS is connected</h3>
          <p className="mt-2 text-sm text-emerald-900/90 leading-relaxed">
            Mennyu can send paid orders to your kitchen through your linked channel. You can return to orders anytime.
          </p>
          <Link
            href={ordersHref}
            className="mt-4 inline-flex rounded-lg bg-emerald-900 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-950"
          >
            Back to orders
          </Link>
        </div>
        <details className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <summary className="cursor-pointer text-sm font-medium text-stone-800">
            Advanced · manual connection IDs
          </summary>
          <p className="mt-2 text-xs text-stone-500">
            Support, sandbox testing, or recovery. Most restaurants do not need to change these.
          </p>
          <ManualConnectionForm vendor={vendor} />
        </details>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {vendor.posConnectionStatus === "error" ? (
        <div
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          <p className="font-medium">Automatic connection needs attention</p>
          <p className="mt-1 text-amber-900/90">
            {vendor.deliverectAutoMapLastDetail?.trim()
              ? vendor.deliverectAutoMapLastDetail
              : "We could not confirm the link automatically. You can restart setup below, or ask an admin to connect manually."}
          </p>
        </div>
      ) : null}

      <div className="flex gap-2 text-xs font-medium text-stone-500">
        <span className={step >= 0 ? "text-mennyu-primary" : ""}>1 · Overview</span>
        <span>→</span>
        <span className={step >= 1 ? "text-mennyu-primary" : ""}>2 · Connect</span>
        <span>→</span>
        <span className={step >= 2 ? "text-mennyu-primary" : ""}>3 · Waiting</span>
      </div>

      {step === 0 && (
        <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-stone-900">Send orders to your kitchen</h3>
          <p className="text-sm text-stone-600 leading-relaxed">
            Mennyu routes paid orders to the same system your kitchen already uses. Connect your POS hub once; when
            you finish setup there, we attach your Mennyu restaurant automatically — no technical IDs required in the
            normal flow.
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
            Exact availability depends on your POS and account — you’ll finish linking in your POS hub, then we connect
            here when activation completes.
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
          <h3 className="text-base font-semibold text-stone-900">Connect your POS hub</h3>
          <ol className="list-decimal space-y-3 pl-5 text-sm text-stone-600 leading-relaxed">
            <li>Open your POS hub (the same place you manage menus and tickets) and connect your in-store POS if needed.</li>
            <li>
              Use the <strong>same email</strong> below when you sign in or register in that hub — we match it exactly
              when your channel activates.
            </li>
            <li>Complete Deliverect&apos;s steps for your location. When activation finishes, we link your Mennyu account automatically.</li>
          </ol>
          <MennyuLocationIdField mennyuLocationId={vendor.id} className="mt-4" />

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
            <span className="font-medium text-stone-800">Email you use for your POS hub</span>
            <input
              type="email"
              value={accountEmail}
              onChange={(e) => setAccountEmail(e.target.value)}
              className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
              placeholder="you@restaurant.com"
              autoComplete="email"
              required
            />
            <span className="mt-1 block text-xs text-stone-500">
              Required for automatic linking — must match the hub account email exactly.
            </span>
          </label>

          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              disabled={loading}
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={() => {
                setError(null);
                setLoading(true);
                void (async () => {
                  try {
                    const r = await startDeliverectPosOnboarding({
                      vendorId: vendor.id,
                      deliverectAccountEmail: accountEmail,
                      posProvider: posProvider.trim() || null,
                    });
                    if (!r.ok) {
                      setError(r.error);
                      return;
                    }
                    setLocalPendingKey(r.pendingKey);
                    setStep(2);
                    router.refresh();
                  } finally {
                    setLoading(false);
                  }
                })();
              }}
            >
              {loading ? "Saving…" : "I’ve started setup in my POS hub"}
            </button>
            <button type="button" className="text-sm text-stone-600 hover:text-stone-900" onClick={() => setStep(0)}>
              Back
            </button>
            <Link href={ordersHref} className="text-sm text-stone-500 hover:text-stone-800">
              Skip for now
            </Link>
          </div>

          <details className="rounded-lg border border-stone-100 bg-stone-50/80 p-3 text-sm">
            <summary className="cursor-pointer font-medium text-stone-700">Advanced · enter channel link ID manually</summary>
            <p className="mt-2 text-xs text-stone-500">
              Only if an admin gave you IDs or you’re fixing a connection by hand. Not required for the normal flow.
            </p>
            <ManualConnectionForm vendor={vendor} />
          </details>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-stone-900">We’ll connect you when setup finishes</h3>
          <p className="text-sm text-stone-600 leading-relaxed">
            Finish activation in your POS hub and Deliverect. When your channel is registered, Mennyu will attach the
            real channel link automatically — you don’t need to paste technical IDs.
          </p>
          {displayPendingKey ? (
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
              <p className="text-xs font-medium text-stone-600">Your Mennyu reference (for support)</p>
              <p className="mt-1 break-all font-mono text-xs text-stone-900">{displayPendingKey}</p>
              <p className="mt-2 text-xs text-stone-500">
                If Deliverect or Mennyu support asks for a reference, share this value. It may also be sent as
                metadata on the channel registration webhook.
              </p>
            </div>
          ) : null}
          <p className="text-xs text-stone-500">
            You can leave this page — we’ll update your connection when the webhook arrives. If nothing changes after
            setup, contact support or ask an admin to map manually.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href={ordersHref}
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white"
            >
              Return to orders
            </Link>
            <button type="button" className="text-sm text-stone-600 hover:text-stone-900" onClick={() => setStep(1)}>
              Edit email / POS
            </button>
          </div>

          <details className="rounded-lg border border-stone-100 bg-stone-50/80 p-3 text-sm">
            <summary className="cursor-pointer font-medium text-stone-700">Advanced · manual connection IDs</summary>
            <ManualConnectionForm vendor={vendor} onSaved={() => router.refresh()} />
          </details>
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PosConnectionStatus } from "@prisma/client";
import { saveVendorPosConnection, startDeliverectPosOnboarding } from "@/actions/vendor-pos.actions";
import { MennyuLocationIdField } from "@/components/vendor/MennyuLocationIdField";
import { deriveVendorPosUiState, vendorPosUiStateGuidance } from "@/lib/vendor-pos-ui-state";

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
  hasUnmatchedChannelRegistration?: boolean;
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
        Admin or support use: the <strong>channel link ID</strong> is what Mennyu uses to send orders after Deliverect
        gives you a link. The optional <strong>Deliverect location ID</strong> is only extra metadata for some setups —
        your Mennyu Location ID above is what you paste into Deliverect as <strong>channelLocationId</strong> during setup.
      </p>
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
        <span className="font-medium text-stone-800">Deliverect channel link ID</span>
        <input
          value={channelLinkId}
          onChange={(e) => setChannelLinkId(e.target.value)}
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2 font-mono text-sm"
          placeholder="After activation — usually applied automatically"
          autoComplete="off"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-stone-800">Deliverect location ID (optional)</span>
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

  const WAITING_STEP = 3;

  const [step, setStep] = useState(() => {
    if (
      vendor.pendingDeliverectConnectionKey &&
      vendor.posConnectionStatus === "onboarding" &&
      !vendor.deliverectChannelLinkId
    ) {
      return WAITING_STEP;
    }
    return 0;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localPendingKey, setLocalPendingKey] = useState<string | null>(null);

  const [posProvider, setPosProvider] = useState(vendor.posProvider ?? vendor.posType ?? "");
  const [accountEmail, setAccountEmail] = useState(vendor.deliverectAccountEmail ?? "");

  const displayPendingKey = localPendingKey ?? vendor.pendingDeliverectConnectionKey ?? null;

  const ui = deriveVendorPosUiState({
    deliverectChannelLinkId: vendor.deliverectChannelLinkId,
    posConnectionStatus: vendor.posConnectionStatus,
    deliverectAutoMapLastOutcome: vendor.deliverectAutoMapLastOutcome,
    pendingDeliverectConnectionKey: vendor.pendingDeliverectConnectionKey,
    hasUnmatchedChannelRegistrationForVendor: Boolean(vendor.hasUnmatchedChannelRegistration),
  });

  if (vendor.deliverectChannelLinkId?.trim()) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 p-5 shadow-sm">
          <h3 className="text-base font-semibold text-emerald-950">Your POS is connected</h3>
          <p className="mt-2 text-sm text-emerald-900/90 leading-relaxed">
            Mennyu routes paid orders using your <strong>Deliverect channel link ID</strong>. You can review connection
            details on the Orders page anytime.
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
            Advanced · manual IDs (support / recovery)
          </summary>
          <p className="mt-2 text-xs text-stone-500">
            Rare cases only. Channel link ID is the live routing key; Deliverect location ID is optional metadata.
          </p>
          <MennyuLocationIdField mennyuLocationId={vendor.id} className="mt-4" />
          <ManualConnectionForm vendor={vendor} />
        </details>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {(ui === "needs_attention" || vendor.posConnectionStatus === "error") && (
        <div
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          <p className="font-medium">Connection needs a quick check</p>
          <p className="mt-1 text-amber-900/90">
            {vendorPosUiStateGuidance(ui, { hasUnmatchedRegistration: vendor.hasUnmatchedChannelRegistration })}
          </p>
          {vendor.deliverectAutoMapLastDetail?.trim() && vendor.posConnectionStatus === "error" ? (
            <p className="mt-2 text-xs text-amber-900/80">{vendor.deliverectAutoMapLastDetail}</p>
          ) : null}
        </div>
      )}

      <div className="flex flex-wrap gap-2 text-xs font-medium text-stone-500">
        <span className={step >= 0 ? "text-mennyu-primary" : ""}>1 · Your ID</span>
        <span>→</span>
        <span className={step >= 1 ? "text-mennyu-primary" : ""}>2 · Deliverect</span>
        <span>→</span>
        <span className={step >= 2 ? "text-mennyu-primary" : ""}>3 · Account</span>
        <span>→</span>
        <span className={step >= 3 ? "text-mennyu-primary" : ""}>4 · Connecting</span>
      </div>

      {step === 0 && (
        <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-stone-900">Connect your kitchen POS</h3>
          <p className="text-sm text-stone-600 leading-relaxed">
            In four short steps you&apos;ll copy your Mennyu Location ID into Deliverect, finish activation there, and
            Mennyu will attach the real channel link automatically — no need to hunt for technical IDs in the normal
            flow.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white"
              onClick={() => setStep(1)}
            >
              Start
            </button>
            <Link href={ordersHref} className="rounded-lg px-4 py-2 text-sm text-stone-600 hover:text-stone-900">
              Skip for now
            </Link>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <MennyuLocationIdField mennyuLocationId={vendor.id} variant="emphasized" />
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white"
              onClick={() => setStep(2)}
            >
              I’ve copied it
            </button>
            <button type="button" className="text-sm text-stone-600 hover:text-stone-900" onClick={() => setStep(0)}>
              Back
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-stone-900">Paste into Deliverect</h3>
          <ol className="list-decimal space-y-3 pl-5 text-sm text-stone-600 leading-relaxed">
            <li>Open your Deliverect / POS hub flow where you add or edit the channel for this restaurant.</li>
            <li>
              Find the field for <strong>channel location ID</strong>, <strong>merchant ID</strong>, or{" "}
              <strong>external location ID</strong> (Deliverect calls this <code className="text-xs">channelLocationId</code>
              ).
            </li>
            <li>Paste your <strong>Mennyu Location ID</strong> from the previous step — same value, exactly.</li>
            <li>Save in Deliverect, then complete any remaining activation steps there.</li>
          </ol>
          <p className="text-xs text-stone-500">
            After Deliverect activates the channel, it sends Mennyu a secure signal and we attach the routing ID for
            orders automatically.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white"
              onClick={() => setStep(3)}
            >
              Continue
            </button>
            <button type="button" className="text-sm text-stone-600 hover:text-stone-900" onClick={() => setStep(1)}>
              Back
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-stone-900">Your Mennyu account details</h3>
          <p className="text-sm text-stone-600">
            We use your POS hub email as a backup match. Choose your POS brand so we can show the right guidance later.
          </p>
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
                    setStep(WAITING_STEP);
                    router.refresh();
                  } finally {
                    setLoading(false);
                  }
                })();
              }}
            >
              {loading ? "Saving…" : "I’ve finished in Deliverect — connect my account"}
            </button>
            <button type="button" className="text-sm text-stone-600 hover:text-stone-900" onClick={() => setStep(2)}>
              Back
            </button>
            <Link href={ordersHref} className="text-sm text-stone-500 hover:text-stone-800">
              Skip for now
            </Link>
          </div>
          <details className="rounded-lg border border-stone-100 bg-stone-50/80 p-3 text-sm">
            <summary className="cursor-pointer font-medium text-stone-700">Advanced · enter channel link ID manually</summary>
            <ManualConnectionForm vendor={vendor} />
          </details>
        </div>
      )}

      {step === WAITING_STEP && (
        <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-stone-900">We&apos;re connecting your account</h3>
          <p className="text-sm text-stone-600 leading-relaxed">
            When Deliverect finishes activation, Mennyu receives a secure registration and attaches your{" "}
            <strong>channel link ID</strong> (the ID that actually routes orders). You don&apos;t need to paste that ID
            yourself in the normal flow.
          </p>
          {displayPendingKey ? (
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
              <p className="text-xs font-medium text-stone-600">Support reference</p>
              <p className="mt-1 break-all font-mono text-xs text-stone-900">{displayPendingKey}</p>
            </div>
          ) : null}
          <p className="text-xs text-stone-500">
            You can leave this page. If something doesn&apos;t connect after a few minutes, confirm your Mennyu Location ID
            is entered exactly in Deliverect, then try &quot;Check connection again&quot; from Orders, or contact support.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href={ordersHref} className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white">
              Return to orders
            </Link>
            <button type="button" className="text-sm text-stone-600 hover:text-stone-900" onClick={() => setStep(3)}>
              Edit account details
            </button>
          </div>
          <details className="rounded-lg border border-stone-100 bg-stone-50/80 p-3 text-sm">
            <summary className="cursor-pointer font-medium text-stone-700">Advanced · manual connection IDs</summary>
            <MennyuLocationIdField mennyuLocationId={vendor.id} className="mt-3" />
            <ManualConnectionForm vendor={vendor} onSaved={() => router.refresh()} />
          </details>
        </div>
      )}
    </div>
  );
}

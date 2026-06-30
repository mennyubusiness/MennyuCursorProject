"use client";

import { playVendorOrderAlertSound, unlockVendorOrderAlertAudio } from "@/lib/vendor-order-alert-sound";

export function VendorKitchenTestSoundButton() {
  return (
    <button
      type="button"
      onClick={() => {
        unlockVendorOrderAlertAudio();
        playVendorOrderAlertSound();
      }}
      className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-oo-light-stone bg-oo-warm-white px-4 py-2.5 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream"
    >
      Test sound
    </button>
  );
}

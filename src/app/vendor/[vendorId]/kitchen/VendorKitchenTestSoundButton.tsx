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
      className="min-h-[44px] rounded-xl border border-oo-light-stone bg-oo-warm-white px-4 py-2.5 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream"
    >
      Test sound
    </button>
  );
}

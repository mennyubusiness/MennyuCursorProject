/**
 * Lightweight new-order alert sound for vendor kitchen/dashboard (client-only).
 */

let sharedAudioContext: AudioContext | null = null;

/** Call from a user gesture (e.g. Test sound) to satisfy browser autoplay policies. */
export function unlockVendorOrderAlertAudio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioContext) {
    sharedAudioContext = new Ctx();
  }
  if (sharedAudioContext.state === "suspended") {
    void sharedAudioContext.resume();
  }
  return sharedAudioContext;
}

export function playVendorOrderAlertSound(): boolean {
  try {
    const ctx = unlockVendorOrderAlertAudio();
    if (!ctx) return false;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
    return true;
  } catch {
    return false;
  }
}

export const VENDOR_ORDER_ALERT_REPEAT_MS = 30_000;

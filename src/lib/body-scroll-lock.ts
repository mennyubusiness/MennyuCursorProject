/**
 * Reference-counted document scroll lock for overlays (modals, sheets, drawers).
 * Multiple overlays can nest; scroll restores only when the last lock releases.
 */

let lockCount = 0;
let savedBodyOverflow = "";
let savedHtmlOverflow = "";

function applyLock() {
  savedBodyOverflow = document.body.style.overflow;
  savedHtmlOverflow = document.documentElement.style.overflow;
  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";
}

function applyUnlock() {
  document.body.style.overflow = savedBodyOverflow;
  document.documentElement.style.overflow = savedHtmlOverflow;
  savedBodyOverflow = "";
  savedHtmlOverflow = "";
}

/** Lock background scroll. Returns an unlock function — call on close/unmount. */
export function lockBodyScroll(): () => void {
  if (typeof document === "undefined") {
    return () => {};
  }

  if (lockCount === 0) {
    applyLock();
  }
  lockCount += 1;

  let released = false;
  return () => {
    if (released || typeof document === "undefined") return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) {
      applyUnlock();
    }
  };
}

/** Whether any overlay currently holds the scroll lock (for tests). */
export function getBodyScrollLockCount(): number {
  return lockCount;
}

/** Reset lock state — test helper only. */
export function resetBodyScrollLockForTests(): void {
  if (typeof document !== "undefined" && lockCount > 0) {
    applyUnlock();
  }
  lockCount = 0;
}

/** Read current inline overflow styles (for tests). */
export function readBodyScrollLockStyles(): {
  bodyOverflow: string;
  htmlOverflow: string;
  lockCount: number;
} {
  if (typeof document === "undefined") {
    return { bodyOverflow: "", htmlOverflow: "", lockCount };
  }
  return {
    bodyOverflow: document.body.style.overflow,
    htmlOverflow: document.documentElement.style.overflow,
    lockCount,
  };
}

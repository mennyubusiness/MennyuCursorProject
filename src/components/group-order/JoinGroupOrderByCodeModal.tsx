"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { validateGroupOrderJoinCodeAction } from "@/actions/group-order.actions";
import { normalizeGroupOrderJoinCodeInput } from "@/app/cart/JoinGroupOrderByCodeForm";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type JoinGroupOrderByCodeModalProps = {
  open: boolean;
  onClose: () => void;
  overlayClassName?: string;
};

export function JoinGroupOrderByCodeModal({
  open,
  onClose,
  overlayClassName = "z-50",
}: JoinGroupOrderByCodeModalProps) {
  const router = useRouter();
  const titleId = useId();
  const helperId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const resetForm = useCallback(() => {
    setValue("");
    setError(null);
    setPending(false);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, handleClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const code = normalizeGroupOrderJoinCodeInput(value);
    if (!code) {
      setError("Enter a group order code.");
      return;
    }
    if (code.length !== 6) {
      setError("Code must be exactly 6 digits.");
      return;
    }

    setPending(true);
    try {
      const result = await validateGroupOrderJoinCodeAction(value);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      handleClose();
      router.push(result.joinPath);
    } finally {
      setPending(false);
    }
  }

  if (!open || !mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 flex items-end justify-center bg-oo-cream/80 p-4 backdrop-blur-sm sm:items-center",
        overlayClassName
      )}
      role="presentation"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-[0_16px_48px_rgba(31,31,28,0.18)] sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={helperId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-xl font-bold tracking-tight text-oo-charcoal">
          Join a group order
        </h2>
        <p id={helperId} className="mt-2 text-sm leading-relaxed text-oo-stone-gray">
          Enter the group order code shared by your host.
        </p>

        <form onSubmit={(e) => void onSubmit(e)} className="mt-5 space-y-4">
          <div>
            <label htmlFor="join-group-order-code" className="oo-label">
              Group order code
            </label>
            <input
              ref={inputRef}
              id="join-group-order-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={value}
              disabled={pending}
              onChange={(e) => {
                const digits = normalizeGroupOrderJoinCodeInput(e.target.value).slice(0, 6);
                setValue(digits);
                if (error) setError(null);
              }}
              placeholder="000000"
              className="oo-input mt-1 min-h-12 font-mono text-lg tracking-[0.35em]"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : helperId}
            />
            {error ? (
              <p id={errorId} className="oo-form-error mt-2" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleClose}
              disabled={pending}
              className={cn(
                buttonClassName({ variant: "outline", size: "md" }),
                "min-h-11 w-full sm:w-auto"
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              aria-busy={pending}
              className={cn(buttonClassName({ variant: "primary", size: "md" }), "min-h-11 w-full sm:w-auto")}
            >
              {pending ? "Checking code…" : "Join group order"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

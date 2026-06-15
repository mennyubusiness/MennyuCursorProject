"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { validateGroupOrderJoinCodeAction } from "@/actions/group-order.actions";
import { normalizeGroupOrderJoinCodeInput } from "@/app/cart/JoinGroupOrderByCodeForm";
import { MobileBottomSheet } from "@/components/mobile/MobileBottomSheet";
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
  overlayClassName,
}: JoinGroupOrderByCodeModalProps) {
  const router = useRouter();
  const helperId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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

  return (
    <MobileBottomSheet
      open={open}
      onClose={handleClose}
      title="Join a group order"
      description="Enter the group order code shared by your host."
      overlayClassName={overlayClassName}
      initialFocusSelector="#join-group-order-code"
      footer={
        <div className="border-t border-oo-light-stone px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
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
              form="join-group-order-form"
              disabled={pending}
              aria-busy={pending}
              className={cn(
                buttonClassName({ variant: "primary", size: "touch" }),
                "w-full sm:w-auto"
              )}
            >
              {pending ? "Checking code…" : "Join group order"}
            </button>
          </div>
        </div>
      }
    >
      <form id="join-group-order-form" onSubmit={(e) => void onSubmit(e)} className="space-y-4">
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
            className="oo-input oo-input-touch mt-1 font-mono text-lg tracking-[0.35em]"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : helperId}
          />
          <p id={helperId} className="sr-only">
            Enter the 6-digit group order code shared by your host.
          </p>
          {error ? (
            <p id={errorId} className="oo-form-error mt-2" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </form>
    </MobileBottomSheet>
  );
}

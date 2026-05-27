"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ModifierModal } from "@/app/pod/[podId]/vendor/[vendorId]/ModifierModal";
import type { ModifierConfigForUI } from "@/app/pod/[podId]/vendor/[vendorId]/modifier-config";

export type VendorMenuModifierSession = {
  modifierConfig: ModifierConfigForUI;
  cartId: string;
  podId: string;
  vendorId: string;
  vendorUsesDeliverect: boolean;
  menuItemDeliverectVariantParentPlu?: string | null;
};

type VendorMenuModifierContextValue = {
  openModifier: (session: VendorMenuModifierSession) => void;
  closeModifier: () => void;
  isModifierOpen: boolean;
};

const VendorMenuModifierContext = createContext<VendorMenuModifierContextValue | null>(null);

export function VendorMenuModifierProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<VendorMenuModifierSession | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const openModifier = useCallback((next: VendorMenuModifierSession) => {
    setSession(next);
  }, []);

  const closeModifier = useCallback(() => {
    setSession(null);
  }, []);

  useEffect(() => {
    if (!session) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModifier();
    };
    window.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [session, closeModifier]);

  const value = useMemo(
    () => ({
      openModifier,
      closeModifier,
      isModifierOpen: session != null,
    }),
    [openModifier, closeModifier, session]
  );

  const modal =
    session && mounted
      ? createPortal(
          <ModifierModal
            config={session.modifierConfig}
            cartId={session.cartId}
            podId={session.podId}
            vendorId={session.vendorId}
            onClose={closeModifier}
            onSuccess={() => {
              router.refresh();
              closeModifier();
            }}
            vendorUsesDeliverect={session.vendorUsesDeliverect}
            menuItemDeliverectVariantParentPlu={session.menuItemDeliverectVariantParentPlu}
          />,
          document.body
        )
      : null;

  return (
    <VendorMenuModifierContext.Provider value={value}>
      {children}
      {modal}
    </VendorMenuModifierContext.Provider>
  );
}

export function useVendorMenuModifier(): VendorMenuModifierContextValue {
  const ctx = useContext(VendorMenuModifierContext);
  if (!ctx) {
    throw new Error("useVendorMenuModifier must be used within VendorMenuModifierProvider");
  }
  return ctx;
}

"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { BROWSE_POD_ID_SESSION_KEY } from "@/lib/customer-browse-pod";
import type { CurrentPagePod } from "@/lib/current-page-pod";

type CurrentPagePodContextValue = {
  currentPagePod: CurrentPagePod | null;
  setCurrentPagePod: (pod: CurrentPagePod | null) => void;
};

const CurrentPagePodContext = createContext<CurrentPagePodContextValue | null>(null);

export function CurrentPagePodProvider({ children }: { children: ReactNode }) {
  const [currentPagePod, setCurrentPagePod] = useState<CurrentPagePod | null>(null);
  const value = useMemo(
    () => ({ currentPagePod, setCurrentPagePod }),
    [currentPagePod]
  );
  return (
    <CurrentPagePodContext.Provider value={value}>{children}</CurrentPagePodContext.Provider>
  );
}

export function useCurrentPagePod(): CurrentPagePod | null {
  return useContext(CurrentPagePodContext)?.currentPagePod ?? null;
}

function useCurrentPagePodRegistry(): CurrentPagePodContextValue {
  const ctx = useContext(CurrentPagePodContext);
  if (!ctx) {
    throw new Error("useCurrentPagePodRegistry must be used within CurrentPagePodProvider");
  }
  return ctx;
}

/** Sync server-resolved pod into Quick Cart browse context for slug customer routes. */
export function CurrentPagePodSync({ currentPagePod }: { currentPagePod: CurrentPagePod }) {
  const { setCurrentPagePod } = useCurrentPagePodRegistry();

  useLayoutEffect(() => {
    setCurrentPagePod(currentPagePod);
    sessionStorage.setItem(BROWSE_POD_ID_SESSION_KEY, currentPagePod.id);
    return () => setCurrentPagePod(null);
  }, [currentPagePod, setCurrentPagePod]);

  return null;
}

"use client";

import { createContext, useContext, useCallback, useState, type ReactNode } from "react";

interface PresenceContextValue {
  online: boolean;
  browsingContext: string;
  setBrowsingContext: (ctx: string) => void;
}

const PresenceContext = createContext<PresenceContextValue>({
  online: true,
  browsingContext: "",
  setBrowsingContext: () => {},
});

export function PresenceProvider({ children }: { children: ReactNode }) {
  const [browsingContext, setBrowsingContextState] = useState("");
  const setBrowsingContext = useCallback((ctx: string) => {
    setBrowsingContextState(ctx);
  }, []);

  return (
    <PresenceContext.Provider
      value={{ online: true, browsingContext, setBrowsingContext }}
    >
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  return useContext(PresenceContext);
}

export const usePresenceContext = usePresence;

export default PresenceProvider;

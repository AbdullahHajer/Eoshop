import React, { createContext, useContext, type ReactNode } from "react";
import type { UiAdapters } from "./uiAdapters";

const UiAdaptersContext = createContext<UiAdapters | null>(null);

export function UiAdaptersProvider({ adapters, children }: { adapters: UiAdapters; children: ReactNode }) {
  return <UiAdaptersContext.Provider value={adapters}>{children}</UiAdaptersContext.Provider>;
}

export function useUiAdapters(): UiAdapters {
  const adapters = useContext(UiAdaptersContext);
  if (!adapters) throw new Error("UiAdaptersProvider is required at the application boundary.");
  return adapters;
}

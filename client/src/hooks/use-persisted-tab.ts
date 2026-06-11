import { useState, useEffect } from "react";

interface UsePersistedTabOptions {
  storage?: "local" | "session";
}

export function usePersistedTab(
  key: string,
  defaultTab: string,
  validTabs: string[],
  options?: UsePersistedTabOptions
): [string, (tab: string) => void] {
  const store = options?.storage === "session" ? sessionStorage : localStorage;

  const [tab, setTab] = useState<string>(() => {
    const stored = store.getItem(key);
    return stored && validTabs.includes(stored) ? stored : defaultTab;
  });

  useEffect(() => {
    store.setItem(key, tab);
  }, [key, tab, store]);

  return [tab, setTab];
}

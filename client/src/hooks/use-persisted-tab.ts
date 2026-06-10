import { useState, useEffect } from "react";

export function usePersistedTab(
  key: string,
  defaultTab: string,
  validTabs: string[]
): [string, (tab: string) => void] {
  const [tab, setTab] = useState<string>(() => {
    const stored = localStorage.getItem(key);
    return stored && validTabs.includes(stored) ? stored : defaultTab;
  });

  useEffect(() => {
    localStorage.setItem(key, tab);
  }, [key, tab]);

  return [tab, setTab];
}

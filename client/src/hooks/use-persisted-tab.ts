import { useState, useEffect } from "react";

type TtlValue =
  | number
  | { days?: number; hours?: number; minutes?: number; seconds?: number };

interface UsePersistedTabOptions {
  storage?: "local" | "session";
  ttl?: TtlValue;
}

interface StoredEntry {
  value: string;
  ts: number;
}

function resolveTtlMs(ttl: TtlValue): number {
  if (typeof ttl === "number") return ttl;
  const { days = 0, hours = 0, minutes = 0, seconds = 0 } = ttl;
  return ((days * 24 + hours) * 60 + minutes) * 60 * 1000 + seconds * 1000;
}

function readEntry(
  store: Storage,
  key: string,
  validTabs: string[],
  defaultTab: string,
  ttlMs?: number
): string {
  const raw = store.getItem(key);
  if (!raw) return defaultTab;

  try {
    const parsed = JSON.parse(raw) as StoredEntry;
    if (
      typeof parsed.value === "string" &&
      typeof parsed.ts === "number" &&
      validTabs.includes(parsed.value)
    ) {
      if (ttlMs !== undefined && Date.now() - parsed.ts > ttlMs) {
        store.removeItem(key);
        return defaultTab;
      }
      return parsed.value;
    }
  } catch {
    if (validTabs.includes(raw)) return raw;
  }

  return defaultTab;
}

export function usePersistedTab(
  key: string,
  defaultTab: string,
  validTabs: string[],
  options?: UsePersistedTabOptions
): [string, (tab: string) => void] {
  const store = options?.storage === "session" ? sessionStorage : localStorage;
  const ttlMs = options?.ttl !== undefined ? resolveTtlMs(options.ttl) : undefined;

  const [tab, setTab] = useState<string>(() =>
    readEntry(store, key, validTabs, defaultTab, ttlMs)
  );

  useEffect(() => {
    const entry: StoredEntry = { value: tab, ts: Date.now() };
    store.setItem(key, JSON.stringify(entry));
  }, [key, tab, store]);

  return [tab, setTab];
}

"use client";

import { useEffect, useState } from "react";

/**
 * A quiet "you've done this one" on listing cards. One request per page load,
 * shared by every card.
 */
let cache: Promise<Set<string>> | null = null;

function loadKeys(): Promise<Set<string>> {
  cache ??= fetch("/api/analyses?mine=1", { credentials: "same-origin" })
    .then((response) => (response.ok ? response.json() : { keys: [] }))
    .then((body: { keys?: string[] }) => new Set(body.keys ?? []))
    .catch(() => new Set<string>());
  return cache;
}

export function UnderwrittenMark({ mlsNumber }: { mlsNumber: string }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    let alive = true;
    loadKeys().then((keys) => {
      if (alive) setDone(keys.has(`mls:${mlsNumber.toUpperCase()}`));
    });
    return () => {
      alive = false;
    };
  }, [mlsNumber]);
  if (!done) return null;
  return (
    <span className="tnum inline-flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[10px] font-medium uppercase tracking-[1px] text-white">
      <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M2 6.5 4.8 9 10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Underwritten
    </span>
  );
}

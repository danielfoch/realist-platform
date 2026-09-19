"use client";

import { useEffect, useState } from "react";

export interface Viewer {
  id: string;
  email: string;
  name: string | null;
  city: string | null;
}

/**
 * Who is looking at the page, fetched once per page load from /api/auth/me and
 * shared by every component that asks. Pages stay statically rendered — the
 * signed-in state is layered on in the browser.
 *
 * Returns `undefined` while loading, `null` when signed out.
 */
let inflight: Promise<Viewer | null> | null = null;

function loadViewer(): Promise<Viewer | null> {
  inflight ??= fetch("/api/auth/me", { credentials: "same-origin" })
    .then((response) => (response.ok ? response.json() : null))
    .then((payload: { user?: Viewer | null } | null) => payload?.user ?? null)
    .catch(() => null);
  return inflight;
}

export function useViewer(): Viewer | null | undefined {
  const [viewer, setViewer] = useState<Viewer | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void loadViewer().then((value) => {
      if (alive) setViewer(value);
    });
    return () => {
      alive = false;
    };
  }, []);
  return viewer;
}

/** After login/logout, drop the memo so the next read is fresh. */
export function resetViewerCache(): void {
  inflight = null;
}

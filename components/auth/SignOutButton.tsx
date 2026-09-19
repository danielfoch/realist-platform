"use client";

import { useState } from "react";
import { requestJson, secondaryButtonClass } from "./shared";
import { resetViewerCache } from "./useViewer";

export function SignOutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await requestJson("/api/auth/logout", "POST");
    if (!result.ok) {
      setError(result.error);
      setBusy(false);
      return;
    }
    // Full navigation so every server component re-renders without the cookie.
    resetViewerCache();
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/");
  }

  return (
    <div>
      <button type="button" onClick={signOut} disabled={busy} className={secondaryButtonClass}>
        {busy ? "Signing out…" : "Sign out"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

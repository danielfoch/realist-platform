"use client";

import { useState } from "react";

/**
 * Send a Realist link: the share sheet on a phone, the clipboard on a desktop.
 * The link unfurls into its card (lib/og/card.tsx), so the number travels with it.
 */
export function ShareLinkButton({ path, title, text, label, className }: { path: string; title: string; text: string; label: string; className?: string }) {
  const [note, setNote] = useState<string | null>(null);

  async function share() {
    const url = `${window.location.origin}${path}`;
    if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title, text, url });
        return setNote("Shared.");
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
      }
    }
    await navigator.clipboard.writeText(url).then(
      () => setNote("Link copied."),
      () => setNote(url),
    );
  }

  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      <button type="button" onClick={share} className={className}>
        {label}
      </button>
      {note && (
        <span role="status" className="break-all text-xs text-ink-faint">
          {note}
        </span>
      )}
    </span>
  );
}

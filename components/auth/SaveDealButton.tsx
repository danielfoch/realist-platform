"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { requestJson } from "./shared";
import { useViewer } from "./useViewer";

/**
 * Bookmark a listing or a multiplex underwrite to the member's account.
 *
 * A results page renders dozens of these at once, so the member's saved set is
 * fetched once per page load and shared; every button reads from and writes to
 * the same set. Signed-out visitors are sent to sign in and brought back.
 */

type SaveKind = "listing" | "multiplex";
type SnapshotValue = string | number | boolean | null | undefined;

const savedKeys = new Set<string>();
let savedLoad: Promise<void> | null = null;

function loadSavedKeys(): Promise<void> {
  savedLoad ??= fetch("/api/saved", { credentials: "same-origin" })
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error("unavailable"))))
    .then((payload: { saved?: Array<{ kind: string; refKey: string }> }) => {
      for (const row of payload.saved ?? []) savedKeys.add(`${row.kind}:${row.refKey}`);
    })
    .catch(() => {
      // Let a button mounted later try again; until then everything reads as unsaved.
      savedLoad = null;
    });
  return savedLoad;
}

function goToLogin() {
  const here = window.location.pathname + window.location.search;
  // A full navigation on purpose: it drops the memoized viewer, which is stale
  // when this runs because a session expired.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/login?mode=signup&next=${encodeURIComponent(here)}`);
}

function BookmarkIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg
      className={className}
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6.5 3.75h11a.75.75 0 0 1 .75.75v15.75L12 16.1l-6.25 4.15V4.5a.75.75 0 0 1 .75-.75Z" />
    </svg>
  );
}

export function SaveDealButton({
  kind,
  refKey,
  title,
  snapshot,
  compact = false,
  onDark = false,
}: {
  kind: SaveKind;
  refKey: string;
  title: string;
  /** Headline numbers frozen at save time. Undefined entries are dropped. */
  snapshot?: Record<string, SnapshotValue>;
  /** Icon-only, for cards. */
  compact?: boolean;
  /** Inside `.band-night`: the strong red is too dark to read there, so the
   * label stays in ink and the bright red marks the filled icon instead. */
  onDark?: boolean;
}) {
  const viewer = useViewer();
  const key = `${kind}:${refKey}`;
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!viewer) return;
    let alive = true;
    void loadSavedKeys().then(() => {
      if (alive) setSaved(savedKeys.has(key));
    });
    return () => {
      alive = false;
    };
  }, [viewer, key]);

  useEffect(
    () => () => {
      if (errorTimer.current) clearTimeout(errorTimer.current);
    },
    [],
  );

  function showError(message: string) {
    setError(message);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setError(null), 5000);
  }

  function apply(next: boolean) {
    if (next) savedKeys.add(key);
    else savedKeys.delete(key);
    setSaved(next);
  }

  async function toggle(event: MouseEvent<HTMLButtonElement>) {
    // Rendered inside clickable cards: never let the click reach the card.
    event.preventDefault();
    event.stopPropagation();
    if (viewer === null) {
      goToLogin();
      return;
    }
    if (pending) return;

    const next = !saved;
    apply(next);
    setPending(true);
    setError(null);
    const result = next
      ? await requestJson("/api/saved", "POST", { kind, refKey, title: title.slice(0, 300), snapshot })
      : await requestJson("/api/saved", "DELETE", { kind, refKey });
    setPending(false);
    if (result.ok) return;

    apply(!next);
    // Session ended (or the viewer hadn't loaded yet and there is none).
    if (result.status === 401) {
      goToLogin();
      return;
    }
    showError(result.error);
  }

  const noun = kind === "listing" ? "listing" : "underwrite";
  const hover = onDark ? "hover:bg-surface" : "hover:border-brand hover:text-brand";
  const shape = compact
    ? "h-8 w-8 justify-center bg-surface/95 shadow-sm"
    : `gap-2 px-4 py-2.5 text-sm font-semibold ${onDark ? "" : "bg-surface"}`;

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={saved}
        aria-label={compact ? (saved ? `Saved — remove this ${noun}` : `Save this ${noun}`) : undefined}
        title={compact ? (saved ? "Saved" : "Save") : undefined}
        className={`inline-flex items-center rounded-[3px] border border-hairline-strong transition-colors ${shape} ${hover} ${
          saved && !onDark ? "text-brand" : "text-ink"
        }`}
      >
        <BookmarkIcon filled={saved} className={saved && onDark ? "text-accent" : undefined} />
        {!compact && (saved ? "Saved" : "Save")}
      </button>
      {error && (
        <span
          role="alert"
          className="absolute right-0 top-full z-10 mt-1.5 w-52 rounded-[3px] border border-hairline bg-surface px-2.5 py-2 text-left text-[11px] font-medium leading-snug text-bad shadow-md"
        >
          {error}
        </span>
      )}
    </span>
  );
}

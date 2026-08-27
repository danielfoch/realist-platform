"use client";

import { useState, type FormEvent } from "react";

/**
 * Shared lead-capture form posting to /api/community/join.
 *
 * - variant="inline": email-only capture ("Get event invites") on /community.
 * - variant="full": the work-with-us lead form (name, email, city, what are
 *   you buying, message).
 *
 * Mirrors CommunityLeadSource in lib/db/schema/community.ts — kept as a local
 * union so the client bundle never imports drizzle.
 */
type LeadSource = "meetup_rsvp" | "work_with_us" | "event";

const PROPERTY_INTERESTS = [
  "Multiplex / small apartment",
  "Single-family rental",
  "Condo",
  "Pre-construction",
  "Commercial",
  "Not sure yet",
] as const;

type Status = "idle" | "submitting" | "success" | "error";

export function JoinForm({
  source,
  variant = "inline",
  submitLabel = "Sign up",
  accent = "brand",
  successMessage = "You're on the list. See you at the next one.",
}: {
  source: LeadSource;
  variant?: "inline" | "full";
  submitLabel?: string;
  accent?: "brand" | "signal";
  successMessage?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const buttonClass =
    accent === "signal"
      ? "rounded-md bg-signal px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:brightness-110 disabled:opacity-60"
      : "rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-60";
  const inputClass =
    "w-full rounded-md border border-hairline-strong bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    const payload: Record<string, unknown> = { source };
    for (const key of ["email", "name", "city", "propertyInterest", "message"]) {
      const value = data.get(key);
      if (typeof value === "string" && value.trim()) payload[key] = value.trim();
    }
    payload.consentMarketing = data.get("consentMarketing") === "on";

    setStatus("submitting");
    setError(null);
    try {
      const response = await fetch("/api/community/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!response.ok || !result?.ok) {
        setError(result?.error ?? "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      setStatus("success");
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-md border border-brand/40 bg-brand-wash/60 px-4 py-3 text-sm font-medium text-brand-deep">
        {successMessage}
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <label className="sr-only" htmlFor="join-email">
            Email address
          </label>
          <input
            id="join-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className={inputClass}
          />
          <button type="submit" disabled={status === "submitting"} className={`${buttonClass} shrink-0`}>
            {status === "submitting" ? "Signing up…" : submitLabel}
          </button>
        </div>
        <label className="mt-2.5 flex items-start gap-2 text-xs text-ink-faint">
          <input type="checkbox" name="consentMarketing" className="mt-0.5 accent-brand" />
          Also send me the research letter and new-tool announcements.
        </label>
        {error && <p className="mt-2 text-xs font-medium text-bad">{error}</p>}
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="lead-name" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-faint">
          Name
        </label>
        <input id="lead-name" name="name" type="text" autoComplete="name" placeholder="Jane Investor" className={inputClass} />
      </div>
      <div>
        <label htmlFor="lead-email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-faint">
          Email <span className="text-signal">*</span>
        </label>
        <input id="lead-email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" className={inputClass} />
      </div>
      <div>
        <label htmlFor="lead-city" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-faint">
          City you&rsquo;re buying in
        </label>
        <input id="lead-city" name="city" type="text" placeholder="Toronto, Calgary, Halifax…" className={inputClass} />
      </div>
      <div>
        <label htmlFor="lead-interest" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-faint">
          What are you buying?
        </label>
        <select id="lead-interest" name="propertyInterest" defaultValue="" className={inputClass}>
          <option value="" disabled>
            Choose one…
          </option>
          {PROPERTY_INTERESTS.map((interest) => (
            <option key={interest} value={interest}>
              {interest}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="lead-message" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-faint">
          Anything else we should know?
        </label>
        <textarea
          id="lead-message"
          name="message"
          rows={4}
          placeholder="Budget, timeline, the deal you're circling, a listing key from Realist…"
          className={inputClass}
        />
      </div>
      <div className="sm:col-span-2">
        <label className="flex items-start gap-2 text-xs text-ink-faint">
          <input type="checkbox" name="consentMarketing" className="mt-0.5 accent-brand" />
          Keep me on the list for events and research between deals.
        </label>
      </div>
      <div className="sm:col-span-2">
        <button type="submit" disabled={status === "submitting"} className={buttonClass}>
          {status === "submitting" ? "Sending…" : submitLabel}
        </button>
        {error && <p className="mt-2 text-xs font-medium text-bad">{error}</p>}
      </div>
    </form>
  );
}

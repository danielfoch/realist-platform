"use client";

import { useRef, useState, type FormEvent } from "react";
import { useViewer } from "@/components/auth/useViewer";
import { isMeetupUrl } from "@/lib/community/links";

/**
 * "Save my spot": capture who is coming on Realist first, then hand off to
 * the Meetup event page where the RSVP actually lives. The capture is never
 * allowed to block the RSVP — if saving the lead fails, the hand-off still
 * appears.
 */

export interface RsvpEvent {
  uid: string;
  title: string;
  url: string | null;
  whenLabel: string;
  city: string | null;
}

type Step = "form" | "submitting" | "handoff";

export function RsvpButton({ event, fallbackUrl }: { event: RsvpEvent; fallbackUrl: string | null }) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [step, setStep] = useState<Step>("form");
  // null = untouched, so a signed-in member's details show until they type.
  const [typedName, setName] = useState<string | null>(null);
  const [typedEmail, setEmail] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const viewer = useViewer();

  // Members don't retype what we already know.
  const name = typedName ?? viewer?.name ?? "";
  const email = typedEmail ?? viewer?.email ?? "";

  const meetupUrl = isMeetupUrl(event.url) ? event.url : isMeetupUrl(fallbackUrl) ? fallbackUrl : null;

  function open() {
    setStep("form");
    dialogRef.current?.showModal();
  }

  async function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setStep("submitting");
    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "meetup_rsvp",
          email: email.trim(),
          name: name.trim() || undefined,
          city: event.city ?? undefined,
          context: { eventUid: event.uid, eventTitle: event.title },
          consentMarketing: consent,
          pagePath: window.location.pathname,
        }),
      });
    } catch {
      // The RSVP itself lives on Meetup; never strand someone over our capture.
    }
    setStep("handoff");
  }

  const inputClass =
    "mt-1 w-full rounded-[3px] border border-hairline-strong bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none";

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="shrink-0 rounded-[3px] bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-deep"
      >
        RSVP
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto w-[min(92vw,26rem)] rounded-lg border border-hairline bg-surface p-0 text-ink shadow-xl backdrop:bg-night/60"
        aria-labelledby={`rsvp-title-${event.uid}`}
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="tnum text-[10px] font-medium uppercase tracking-[1.3px] text-brand">
                Save my spot
              </p>
              <h3 id={`rsvp-title-${event.uid}`} className="font-display mt-1.5 text-lg font-semibold leading-snug">
                {event.title}
              </h3>
              <p className="mt-1 text-sm text-ink-soft">
                {event.whenLabel}
                {event.city ? ` · ${event.city}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Close"
              className="rounded p-1 text-ink-faint hover:bg-raised hover:text-ink"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
          </div>

          {step === "handoff" ? (
            <div className="mt-5">
              <p className="text-sm leading-relaxed text-ink-soft">
                You&rsquo;re on our list for this one. RSVPs are counted on Meetup so the venue
                knows how many chairs to set out — one tap finishes it.
              </p>
              {meetupUrl ? (
                <a
                  href={meetupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex items-center justify-between rounded-[3px] bg-brand px-4 py-3 text-sm font-semibold text-white hover:bg-brand-deep"
                >
                  Finish my RSVP on Meetup
                  <span aria-hidden="true">↗</span>
                </a>
              ) : (
                <p className="mt-4 text-sm text-ink-soft">
                  We&rsquo;ll email you the details as soon as the host confirms them.
                </p>
              )}
            </div>
          ) : (
            <form onSubmit={submit} className="mt-5 space-y-3">
              <label className="block text-xs font-medium text-ink-soft">
                Name
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  className={inputClass}
                />
              </label>
              <label className="block text-xs font-medium text-ink-soft">
                Email
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className={inputClass}
                />
              </label>
              <label className="flex items-start gap-2 pt-1 text-xs leading-relaxed text-ink-faint">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 accent-[var(--color-brand)]"
                />
                Email me about future meetups and Realist updates. Unsubscribe any time.
              </label>
              <button
                type="submit"
                disabled={step === "submitting"}
                className="w-full rounded-[3px] bg-brand px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-60"
              >
                {step === "submitting" ? "Saving…" : "Continue"}
              </button>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}

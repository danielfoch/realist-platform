"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { safeNextPath } from "@/lib/auth/origin";
import { resetViewerCache, useViewer, type Viewer } from "./useViewer";
import {
  checkboxClass,
  eyebrowClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  requestJson,
  secondaryButtonClass,
} from "./shared";

/**
 * Sign in or create an account. Password is the primary path; Google and an
 * emailed one-time link appear only when this deployment has them switched on
 * (/api/auth/me reports which).
 */

type Mode = "signin" | "signup";
type Busy = null | "password" | "link";

const MIN_PASSWORD_LENGTH = 8;

/** Codes the auth routes redirect back with, as `/login?error=<code>`. */
const REDIRECT_ERRORS: Record<string, string> = {
  google_unavailable: "Google sign-in isn't switched on yet. Use your password or a sign-in link.",
  google_state: "That Google sign-in didn't finish — it may have been open too long. Please try again.",
  google_unverified: "Google hasn't verified that email address, so we can't sign you in with it. Use another method.",
  google_failed: "Google sign-in didn't go through. Please try again, or use another method.",
  link_expired: "That sign-in link has expired or was already used. Request a new one below.",
  unavailable: "Accounts are briefly unavailable. Please try again in a minute.",
};
const UNKNOWN_REDIRECT_ERROR = "We couldn't sign you in. Please try again.";

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21.6 12.23c0-.68-.06-1.36-.19-2.02H12v3.83h5.39a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.9-1.74 2.98-4.3 2.98-7.33Z" />
      <path d="M12 22c2.7 0 4.97-.89 6.62-2.43l-3.23-2.5c-.9.6-2.04.96-3.39.96-2.6 0-4.81-1.76-5.6-4.12H3.07v2.58A10 10 0 0 0 12 22Z" />
      <path d="M6.4 13.9a6 6 0 0 1 0-3.8V7.51H3.07a10 10 0 0 0 0 8.98L6.4 13.9Z" />
      <path d="M12 5.98c1.47 0 2.79.5 3.83 1.5l2.86-2.87A10 10 0 0 0 3.07 7.5L6.4 10.1C7.19 7.74 9.4 5.98 12 5.98Z" />
    </svg>
  );
}

export function LoginPanel() {
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const errorCode = params.get("error");

  const viewer = useViewer();
  const [methods, setMethods] = useState({ google: false, emailLink: false });
  // Links that invite someone to join (?mode=signup) open on the form that lets them.
  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : "signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(
    errorCode ? (REDIRECT_ERRORS[errorCode] ?? UNKNOWN_REDIRECT_ERROR) : null,
  );
  const [linkSentTo, setLinkSentTo] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement | null>(null);

  // Already signed in: nothing to do here.
  useEffect(() => {
    if (viewer) window.location.replace(next);
  }, [viewer, next]);

  // Which optional sign-in methods this deployment offers.
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { methods?: { google?: boolean; emailLink?: boolean } } | null) => {
        if (!alive || !payload?.methods) return;
        setMethods({ google: Boolean(payload.methods.google), emailLink: Boolean(payload.methods.emailLink) });
      })
      .catch(() => {
        // Password sign-in still works without knowing the optional methods.
      });
    return () => {
      alive = false;
    };
  }, []);

  function switchMode(nextMode: Mode) {
    if (nextMode === mode) return;
    setMode(nextMode);
    setPassword("");
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy("password");
    setError(null);
    const result =
      mode === "signin"
        ? await requestJson<{ ok: true; user: Viewer }>("/api/auth/login", "POST", {
            email: email.trim(),
            password,
          })
        : await requestJson<{ ok: true; user: Viewer }>("/api/auth/signup", "POST", {
            email: email.trim(),
            password,
            name: name.trim() || undefined,
            consentMarketing: consent,
          });
    if (!result.ok) {
      setError(result.error);
      setBusy(null);
      return;
    }
    // Full navigation so server components re-render with the new cookie.
    resetViewerCache();
    window.location.assign(next);
  }

  async function sendLink() {
    if (busy) return;
    const field = emailRef.current;
    if (field && !field.checkValidity()) {
      field.reportValidity();
      return;
    }
    const address = email.trim();
    if (!address) {
      field?.focus();
      setError("Enter your email address first, then we'll send the link.");
      return;
    }
    setBusy("link");
    setError(null);
    const result = await requestJson("/api/auth/magic", "POST", { email: address, next });
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setLinkSentTo(address);
  }

  const signingIn = mode === "signin";
  const disabled = busy !== null || Boolean(viewer);

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:px-6 sm:py-16">
      <p className={`${eyebrowClass} text-brand`}>Members</p>
      <h1 className="font-display mt-2 text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl">
        {signingIn ? (
          <>
            Sign in to <em>Realist</em>.
          </>
        ) : (
          <>
            Create your <em>account</em>.
          </>
        )}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        Save listings and multiplex underwrites, and pick them up again from any device.
      </p>

      <div className="mt-7 rounded-lg border border-hairline bg-surface">
        <div className="grid grid-cols-2 border-b border-hairline" role="group" aria-label="Sign in or create an account">
          {(
            [
              ["signin", "Sign in"],
              ["signup", "Create account"],
            ] as const
          ).map(([value, label]) => {
            const active = mode === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                disabled={disabled}
                onClick={() => switchMode(value)}
                className={`relative px-4 py-3.5 text-[13px] font-medium transition-colors ${
                  active ? "text-ink" : "text-ink-faint hover:text-ink"
                }`}
              >
                {label}
                {active && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-accent" />}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {error && (
            <p role="alert" className="mb-4 text-sm font-medium leading-relaxed text-bad">
              {error}
            </p>
          )}

          <form onSubmit={submit} className="space-y-3">
            {!signingIn && (
              <label className={labelClass}>
                Name <span className="font-normal text-ink-faint">(optional)</span>
                <input
                  type="text"
                  name="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  maxLength={200}
                  disabled={disabled}
                  className={inputClass}
                />
              </label>
            )}
            <label className={labelClass}>
              Email
              <input
                ref={emailRef}
                type="email"
                name="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                inputMode="email"
                maxLength={254}
                disabled={disabled}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Password
              <input
                type="password"
                name="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={signingIn ? "current-password" : "new-password"}
                minLength={signingIn ? undefined : MIN_PASSWORD_LENGTH}
                maxLength={200}
                aria-describedby={signingIn ? undefined : "login-password-rule"}
                disabled={disabled}
                className={inputClass}
              />
              {!signingIn && (
                <span id="login-password-rule" className="mt-1 block font-normal text-ink-faint">
                  At least {MIN_PASSWORD_LENGTH} characters.
                </span>
              )}
            </label>
            {!signingIn && (
              <label className="flex items-start gap-2 pt-1 text-xs leading-relaxed text-ink-faint">
                <input
                  type="checkbox"
                  name="consentMarketing"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  disabled={disabled}
                  className={checkboxClass}
                />
                Email me about meetups and Realist updates. Unsubscribe any time.
              </label>
            )}
            <button type="submit" disabled={disabled} className={`${primaryButtonClass} w-full`}>
              {busy === "password"
                ? signingIn
                  ? "Signing in…"
                  : "Creating your account…"
                : signingIn
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>

          {(methods.google || methods.emailLink) && (
            <>
              <div className="my-5 flex items-center gap-3" aria-hidden="true">
                <span className="h-px flex-1 bg-hairline" />
                <span className={`${eyebrowClass} text-ink-faint`}>or</span>
                <span className="h-px flex-1 bg-hairline" />
              </div>

              <div className="space-y-2.5">
                {methods.google && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      // A route handler that redirects off-site, not a page the router can push to.
                      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                      window.location.assign(`/api/auth/google/start?next=${encodeURIComponent(next)}`);
                    }}
                    className={`${secondaryButtonClass} flex w-full items-center justify-center gap-2.5`}
                  >
                    <GoogleMark />
                    Continue with Google
                  </button>
                )}

                {methods.emailLink &&
                  (linkSentTo ? (
                    <p
                      role="status"
                      className="rounded-[3px] border border-hairline bg-paper px-4 py-3 text-sm leading-relaxed text-ink"
                    >
                      Check your inbox — the link works once and expires in 20 minutes.
                      <span className="mt-1 block text-xs text-ink-faint">
                        Sent to {linkSentTo}.{" "}
                        <button
                          type="button"
                          onClick={() => setLinkSentTo(null)}
                          className="font-medium text-brand hover:text-brand-deep"
                        >
                          Use a different email
                        </button>
                      </span>
                    </p>
                  ) : (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={sendLink}
                      className={`${secondaryButtonClass} w-full`}
                    >
                      {busy === "link" ? "Sending…" : "Email me a sign-in link"}
                    </button>
                  ))}
              </div>
            </>
          )}

          <p className="mt-5 border-t border-hairline pt-4 text-xs leading-relaxed text-ink-faint">
            Had an account on the old Realist? Your login came with you.
            {methods.emailLink && " Never set a password, or forgot it? Use “Email me a sign-in link” — no password needed."}
          </p>
        </div>
      </div>
    </div>
  );
}

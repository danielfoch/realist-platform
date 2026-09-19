"use client";

import { useState, type FormEvent } from "react";
import { inputClass, labelClass, requestJson, secondaryButtonClass } from "./shared";

/**
 * Change the password, or set the first one for an account that has only ever
 * signed in with Google or an emailed link. The server decides whether the
 * current password is needed; it is sent whenever the person typed one.
 */

const MIN_PASSWORD_LENGTH = 8;

type Status = "idle" | "saving" | "saved";

export function PasswordForm({
  hasPassword,
  emailLinkAvailable = false,
}: {
  hasPassword: boolean;
  /** Emailed sign-in links are switched on, so the forgot-password path exists. */
  emailLinkAvailable?: boolean;
}) {
  // Once a first password is set, the form becomes the change-password form.
  const [needsCurrent, setNeedsCurrent] = useState(hasPassword);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "saving") return;
    setStatus("saving");
    setError(null);
    const result = await requestJson("/api/account/password", "POST", {
      current: current || undefined,
      next,
    });
    if (!result.ok) {
      setError(result.error);
      setStatus("idle");
      return;
    }
    setCurrent("");
    setNext("");
    setNeedsCurrent(true);
    setStatus("saved");
  }

  const saving = status === "saving";

  return (
    <form onSubmit={submit} className="space-y-3">
      {!needsCurrent && (
        <p className="text-xs leading-relaxed text-ink-soft">
          You currently sign in with Google or an emailed link. Set a password if you&rsquo;d like to sign in
          with your email and a password too.
        </p>
      )}
      {needsCurrent && (
        <label className={labelClass}>
          Current password
          <input
            type="password"
            name="current"
            value={current}
            onChange={(event) => {
              setCurrent(event.target.value);
              setStatus("idle");
            }}
            autoComplete="current-password"
            maxLength={200}
            aria-describedby={emailLinkAvailable ? "password-current-hint" : undefined}
            disabled={saving}
            className={inputClass}
          />
          {emailLinkAvailable && (
            <span id="password-current-hint" className="mt-1 block font-normal text-ink-faint">
              Forgot it? Sign out, sign back in with an emailed link, and for the next 30 minutes you can set
              a new one here without it.
            </span>
          )}
        </label>
      )}
      <label className={labelClass}>
        {needsCurrent ? "New password" : "Set a password"}
        <input
          type="password"
          name="next"
          required
          value={next}
          onChange={(event) => {
            setNext(event.target.value);
            setStatus("idle");
          }}
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          maxLength={200}
          aria-describedby="password-next-rule"
          disabled={saving}
          className={inputClass}
        />
        <span id="password-next-rule" className="mt-1 block font-normal text-ink-faint">
          At least {MIN_PASSWORD_LENGTH} characters.
        </span>
      </label>

      {error && (
        <p role="alert" className="text-sm font-medium text-bad">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={saving} className={secondaryButtonClass}>
          {saving ? "Saving…" : needsCurrent ? "Change password" : "Set password"}
        </button>
        <span role="status" className="text-xs font-medium text-ink-soft">
          {status === "saved" ? "Saved" : ""}
        </span>
      </div>
    </form>
  );
}

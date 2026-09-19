"use client";

import { useState } from "react";
import { requestJson, secondaryButtonClass } from "./shared";

/**
 * Shown to a member who signed up with a password and hasn't proven the inbox
 * yet. Until they do, their deals are theirs but don't count on the board or in
 * anyone's medians — accounts would otherwise be free to mint.
 */
export function ConfirmEmailNotice({ email, canSend }: { email: string; canSend: boolean }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function send() {
    setState("sending");
    const result = await requestJson("/api/auth/magic", "POST", { email, next: "/account" });
    setState(result.ok ? "sent" : "error");
  }

  return (
    <div role="status" className="rounded-lg border border-hairline-strong bg-surface p-5">
      <p className="text-sm font-semibold text-ink">Confirm your email to count on the leaderboard</p>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
        Your analyses are saved either way. Once you confirm that <span className="break-all font-medium text-ink">{email}</span> is
        yours, they count toward your rank, your badges and each listing&rsquo;s community numbers.
      </p>
      {canSend ? (
        state === "sent" ? (
          <p className="mt-3 text-sm font-medium text-ink">Sent — open the link in that inbox and you&rsquo;re done.</p>
        ) : (
          <button type="button" onClick={send} disabled={state === "sending"} className={`${secondaryButtonClass} mt-4`}>
            {state === "sending" ? "Sending…" : "Email me the confirmation link"}
          </button>
        )
      ) : (
        <p className="mt-3 text-xs text-ink-faint">Confirmation emails are being switched on — you&rsquo;ll be able to do this here shortly.</p>
      )}
      {state === "error" && <p className="mt-2 text-xs font-medium text-bad">That didn&rsquo;t send. Give it a minute and try again.</p>}
    </div>
  );
}

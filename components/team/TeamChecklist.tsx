"use client";

import Link from "next/link";
import { useState } from "react";
import { POWER_TEAM_ROLES } from "@/lib/team/roles";

type State = "have" | "need";

/**
 * The member's own checklist: who's already on their team, who's missing. The
 * gaps become one click to an introduction request with those roles selected.
 */
export function TeamChecklist({ initial, city, province }: { initial: Record<string, State>; city?: string | null; province?: string | null }) {
  const [team, setTeam] = useState<Record<string, State>>(initial);
  const [error, setError] = useState(false);

  async function set(role: string, next: State | null) {
    const previous = team;
    const updated = { ...team };
    if (next) updated[role] = next;
    else delete updated[role];
    setTeam(updated);
    setError(false);
    try {
      const response = await fetch("/api/account/team", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team: updated }),
      });
      if (!response.ok) throw new Error("save failed");
    } catch {
      setTeam(previous);
      setError(true);
    }
  }

  const have = POWER_TEAM_ROLES.filter((role) => team[role.key] === "have").length;
  const needed = POWER_TEAM_ROLES.filter((role) => team[role.key] === "need").map((role) => role.key);
  const query = new URLSearchParams();
  if (needed.length) query.set("roles", needed.join(","));
  if (city) query.set("city", city);
  if (province) query.set("province", province);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="tnum text-sm font-semibold text-ink">
          {have} of {POWER_TEAM_ROLES.length} in place
        </p>
        <div className="h-1 w-28 overflow-hidden rounded-full bg-raised" aria-hidden="true">
          <div className="h-full bg-accent transition-all" style={{ width: `${(have / POWER_TEAM_ROLES.length) * 100}%` }} />
        </div>
      </div>
      <ul className="mt-4 divide-y divide-hairline">
        {POWER_TEAM_ROLES.map((role) => {
          const state = team[role.key] ?? null;
          return (
            <li key={role.key} className="flex items-center justify-between gap-3 py-2.5">
              <span className={`text-sm ${state === "have" ? "text-ink" : "text-ink-soft"}`}>{role.label}</span>
              <span className="flex shrink-0 gap-1" role="group" aria-label={role.label}>
                {(["have", "need"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={state === option}
                    onClick={() => set(role.key, state === option ? null : option)}
                    className={`rounded-[3px] border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      state === option
                        ? option === "have"
                          ? "border-ink bg-ink text-white"
                          : "border-brand bg-brand text-white"
                        : "border-hairline-strong text-ink-faint hover:border-ink hover:text-ink"
                    }`}
                  >
                    {option === "have" ? "Have one" : "Need one"}
                  </button>
                ))}
              </span>
            </li>
          );
        })}
      </ul>
      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-bad">
          Couldn&rsquo;t save that — try again.
        </p>
      )}
      <Link
        href={`/team${query.toString() ? `?${query}` : ""}#request`}
        className="mt-4 inline-block text-sm font-semibold text-brand hover:text-brand-deep"
      >
        {needed.length ? `Get introduced to the ${needed.length} you need →` : "Meet the people we'd introduce you to →"}
      </Link>
    </div>
  );
}

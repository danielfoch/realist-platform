"use client";

import { useState, type FormEvent } from "react";
import { resetViewerCache } from "./useViewer";
import {
  checkboxClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  readOnlyInputClass,
  requestJson,
} from "./shared";

/** The member's profile. Every field is optional; saving a blank field clears it. */

export interface ProfileValues {
  name: string;
  phone: string;
  city: string;
  province: string;
  investorFocus: string;
  consentMarketing: boolean;
  showOnLeaderboard: boolean;
}

const PROVINCES: Array<[code: string, name: string]> = [
  ["AB", "Alberta"],
  ["BC", "British Columbia"],
  ["MB", "Manitoba"],
  ["NB", "New Brunswick"],
  ["NL", "Newfoundland and Labrador"],
  ["NS", "Nova Scotia"],
  ["NT", "Northwest Territories"],
  ["NU", "Nunavut"],
  ["ON", "Ontario"],
  ["PE", "Prince Edward Island"],
  ["QC", "Quebec"],
  ["SK", "Saskatchewan"],
  ["YT", "Yukon"],
];

type Status = "idle" | "saving" | "saved";

export function ProfileForm({ email, initial }: { email: string; initial: ProfileValues }) {
  const [values, setValues] = useState(initial);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof ProfileValues>(field: K, value: ProfileValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setStatus("idle");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "saving") return;
    setStatus("saving");
    setError(null);
    const result = await requestJson("/api/account", "PATCH", {
      name: values.name,
      phone: values.phone,
      city: values.city,
      province: values.province,
      investorFocus: values.investorFocus,
      consentMarketing: values.consentMarketing,
      showOnLeaderboard: values.showOnLeaderboard,
    });
    if (!result.ok) {
      setError(result.error);
      setStatus("idle");
      return;
    }
    // The nav and RSVP forms read the viewer's name and city.
    resetViewerCache();
    setStatus("saved");
  }

  // A province saved on the old site may be spelled out rather than a code.
  const knownProvince = values.province === "" || PROVINCES.some(([code]) => code === values.province);
  const saving = status === "saving";

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className={labelClass}>
        Email
        <input type="email" value={email} readOnly className={readOnlyInputClass} />
      </label>
      <label className={labelClass}>
        Name
        <input
          type="text"
          name="name"
          value={values.name}
          onChange={(event) => set("name", event.target.value)}
          autoComplete="name"
          maxLength={200}
          disabled={saving}
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        Phone
        <input
          type="tel"
          name="phone"
          value={values.phone}
          onChange={(event) => set("phone", event.target.value)}
          autoComplete="tel"
          maxLength={40}
          disabled={saving}
          className={inputClass}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          City
          <input
            type="text"
            name="city"
            value={values.city}
            onChange={(event) => set("city", event.target.value)}
            autoComplete="address-level2"
            maxLength={120}
            disabled={saving}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Province
          <select
            name="province"
            value={values.province}
            onChange={(event) => set("province", event.target.value)}
            autoComplete="address-level1"
            disabled={saving}
            className={inputClass}
          >
            <option value="">—</option>
            {!knownProvince && <option value={values.province}>{values.province}</option>}
            {PROVINCES.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className={labelClass}>
        What are you looking for?
        <textarea
          name="investorFocus"
          value={values.investorFocus}
          onChange={(event) => set("investorFocus", event.target.value)}
          rows={3}
          maxLength={600}
          placeholder="Small multiplexes in the east end, cash-flowing duplexes under $700K…"
          disabled={saving}
          className={`${inputClass} resize-y leading-relaxed`}
        />
      </label>
      <label className="flex items-start gap-2 pt-1 text-xs leading-relaxed text-ink-faint">
        <input
          type="checkbox"
          name="consentMarketing"
          checked={values.consentMarketing}
          onChange={(event) => set("consentMarketing", event.target.checked)}
          disabled={saving}
          className={checkboxClass}
        />
        Email me about meetups and Realist updates. Unsubscribe any time.
      </label>
      <label className="flex items-start gap-2 text-xs leading-relaxed text-ink-faint">
        <input
          type="checkbox"
          name="showOnLeaderboard"
          checked={values.showOnLeaderboard}
          onChange={(event) => set("showOnLeaderboard", event.target.checked)}
          disabled={saving}
          className={checkboxClass}
        />
        Show me on the leaderboard and give me a public track-record page (as &ldquo;First L.&rdquo;)
      </label>

      {error && (
        <p role="alert" className="text-sm font-medium text-bad">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={saving} className={primaryButtonClass}>
          {saving ? "Saving…" : "Save profile"}
        </button>
        <span role="status" className="text-xs font-medium text-ink-soft">
          {status === "saved" ? "Saved" : ""}
        </span>
      </div>
    </form>
  );
}

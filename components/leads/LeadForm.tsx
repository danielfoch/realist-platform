"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useViewer } from "@/components/auth/useViewer";
import { checkboxClass, inputClass, labelClass, primaryButtonClass } from "@/components/auth/shared";
import { KEYPR_CONSENT_TEXT } from "@/lib/leads/consentText";
import { POWER_TEAM_ROLES } from "@/lib/team/roles";

/**
 * The one lead form. Every hand-raise on the site posts to /api/leads through
 * this component, so consent wording, spam protection and what the CRM
 * receives are decided in exactly one place.
 *
 * `ask` lists the optional fields to show; email is always asked. A signed-in
 * member's details are filled in for them.
 */

export type LeadFormKind =
  | "event_invites"
  | "meetup_rsvp"
  | "offer"
  | "showing"
  | "financing"
  | "power_team"
  | "underwriting_help"
  | "pro_application";

type Field = "name" | "phone" | "city" | "province" | "interest" | "timeline" | "roles" | "company" | "licence" | "message";

export interface LeadFormProperty {
  address?: string | null;
  mlsNumber?: string | null;
  price?: number | null;
  url?: string | null;
}

const INTERESTS = [
  "Multiplex / small apartment",
  "Single-family rental",
  "Condo",
  "Pre-construction",
  "Commercial",
  "Not sure yet",
] as const;

const TIMELINES = ["Ready now", "Within 3 months", "3–12 months", "Just researching"] as const;

const PROVINCES = ["ON", "BC", "AB", "QC", "MB", "SK", "NS", "NB", "NL", "PE", "YT", "NT", "NU"] as const;

type Status = "idle" | "submitting" | "success" | "error";

function utmFromLocation(): Record<string, string> | undefined {
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    const value = params.get(key);
    if (value) utm[key] = value.slice(0, 200);
  }
  return Object.keys(utm).length ? utm : undefined;
}

export function LeadForm({
  kind,
  ask = ["name"],
  layout = "stacked",
  property,
  lat,
  lng,
  context,
  defaultProvince,
  defaultCity,
  defaultRoles,
  partnerConsent = false,
  marketingLabel = "Email me about meetups and Realist updates. Unsubscribe any time.",
  messagePlaceholder = "Budget, timeline, the deal you're circling…",
  submitLabel = "Send",
  successMessage = "Got it. A human will be in touch within a business day.",
  successExtra,
  onSuccess,
}: {
  kind: LeadFormKind;
  ask?: Field[];
  /** "inline" = one row (email + button); "stacked" = labelled fields. */
  layout?: "inline" | "stacked";
  property?: LeadFormProperty;
  lat?: number | null;
  lng?: number | null;
  context?: Record<string, unknown>;
  defaultProvince?: string | null;
  defaultCity?: string | null;
  defaultRoles?: string[];
  /** Offer the brokerage-partner handoff box (shown for Ontario only). */
  partnerConsent?: boolean;
  marketingLabel?: string;
  messagePlaceholder?: string;
  submitLabel?: string;
  successMessage?: string;
  successExtra?: ReactNode;
  onSuccess?: () => void;
}) {
  const viewer = useViewer();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [province, setProvince] = useState(defaultProvince ?? "");
  const [roles, setRoles] = useState<string[]>(defaultRoles ?? []);
  // null = untouched, so a member's details show until they type over them.
  const [typed, setTyped] = useState<{ name: string | null; email: string | null; city: string | null }>({
    name: null,
    email: null,
    city: null,
  });
  const name = typed.name ?? viewer?.name ?? "";
  const email = typed.email ?? viewer?.email ?? "";
  const city = typed.city ?? defaultCity ?? viewer?.city ?? "";

  const shows = (field: Field) => ask.includes(field);
  const showPartnerBox = partnerConsent && province === "ON";
  const uid = `lead-${kind}`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;
    const data = new FormData(event.currentTarget);
    const text = (key: string) => {
      const value = data.get(key);
      return typeof value === "string" && value.trim() ? value.trim() : undefined;
    };
    if (shows("roles") && roles.length === 0) {
      setError(kind === "pro_application" ? "Pick what you do." : "Pick at least one person you need on your team.");
      setStatus("error");
      return;
    }

    const payload = {
      kind,
      email: email.trim(),
      name: name.trim() || undefined,
      phone: text("phone"),
      city: city.trim() || undefined,
      province: province || undefined,
      message: text("message"),
      property,
      lat: typeof lat === "number" ? lat : undefined,
      lng: typeof lng === "number" ? lng : undefined,
      context: {
        ...context,
        ...(text("interest") ? { interest: text("interest") } : {}),
        ...(text("timeline") ? { timeline: text("timeline") } : {}),
        ...(roles.length ? { roles } : {}),
        ...(text("company") ? { company: text("company") } : {}),
        ...(text("licence") ? { licence: text("licence") } : {}),
      },
      consentMarketing: data.get("consentMarketing") === "on",
      consentPartner: showPartnerBox && data.get("consentPartner") === "on",
      pagePath: window.location.pathname,
      utm: utmFromLocation(),
      website: text("website"),
    };

    setStatus("submitting");
    setError(null);
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !result?.ok) {
        setError(result?.error ?? "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      setStatus("success");
      onSuccess?.();
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div role="status" className="rounded-[3px] border border-hairline bg-paper px-4 py-3 text-sm leading-relaxed text-ink">
        <p className="font-medium">{successMessage}</p>
        {successExtra && <div className="mt-2">{successExtra}</div>}
      </div>
    );
  }

  const honeypot = (
    <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
      <label>
        Website
        <input type="text" name="website" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );

  const emailInput = (
    <input
      id={`${uid}-email`}
      name="email"
      type="email"
      required
      autoComplete="email"
      inputMode="email"
      maxLength={254}
      placeholder="you@example.com"
      value={email}
      onChange={(e) => setTyped((current) => ({ ...current, email: e.target.value }))}
      className={inputClass}
    />
  );

  if (layout === "inline") {
    return (
      <form onSubmit={handleSubmit} className="relative">
        {honeypot}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
          <label htmlFor={`${uid}-email`} className="sr-only">
            Email address
          </label>
          <div className="flex-1 [&>input]:mt-0">{emailInput}</div>
          <button type="submit" disabled={status === "submitting"} className={`${primaryButtonClass} shrink-0`}>
            {status === "submitting" ? "Sending…" : submitLabel}
          </button>
        </div>
        <label className="mt-2.5 flex items-start gap-2 text-xs leading-relaxed text-ink-faint">
          <input type="checkbox" name="consentMarketing" className={checkboxClass} />
          {marketingLabel}
        </label>
        {error && (
          <p role="alert" className="mt-2 text-xs font-medium text-bad">
            {error}
          </p>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="relative grid gap-3 sm:grid-cols-2">
      {honeypot}
      {shows("name") && (
        <label className={labelClass}>
          Name
          <input
            name="name"
            type="text"
            autoComplete="name"
            maxLength={200}
            required={partnerConsent}
            value={name}
            onChange={(e) => setTyped((current) => ({ ...current, name: e.target.value }))}
            className={inputClass}
          />
        </label>
      )}
      <label className={`${labelClass} ${shows("name") ? "" : "sm:col-span-2"}`}>
        Email
        {emailInput}
      </label>
      {shows("phone") && (
        <label className={labelClass}>
          Phone {!partnerConsent && <span className="font-normal text-ink-faint">(optional)</span>}
          <input name="phone" type="tel" autoComplete="tel" inputMode="tel" maxLength={40} className={inputClass} />
        </label>
      )}
      {shows("city") && (
        <label className={labelClass}>
          City you&rsquo;re buying in
          <input
            name="city"
            type="text"
            maxLength={120}
            placeholder="Toronto, Calgary, Halifax…"
            value={city}
            onChange={(e) => setTyped((current) => ({ ...current, city: e.target.value }))}
            className={inputClass}
          />
        </label>
      )}
      {(shows("province") || partnerConsent) && (
        <label className={labelClass}>
          Province
          <select name="province" value={province} onChange={(e) => setProvince(e.target.value)} className={inputClass}>
            <option value="">—</option>
            {PROVINCES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
      )}
      {shows("interest") && (
        <label className={labelClass}>
          What are you buying?
          <select name="interest" defaultValue="" className={inputClass}>
            <option value="">Choose one…</option>
            {INTERESTS.map((interest) => (
              <option key={interest} value={interest}>
                {interest}
              </option>
            ))}
          </select>
        </label>
      )}
      {shows("timeline") && (
        <label className={labelClass}>
          When?
          <select name="timeline" defaultValue="" className={inputClass}>
            <option value="">Choose one…</option>
            {TIMELINES.map((timeline) => (
              <option key={timeline} value={timeline}>
                {timeline}
              </option>
            ))}
          </select>
        </label>
      )}
      {shows("roles") && (
        <fieldset className="sm:col-span-2">
          <legend className={labelClass}>{kind === "pro_application" ? "What do you do?" : "Who do you need?"}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {POWER_TEAM_ROLES.map((role) => {
              const on = roles.includes(role.key);
              return (
                <button
                  key={role.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setRoles((current) => (on ? current.filter((key) => key !== role.key) : [...current, role.key]))}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    on ? "border-brand bg-brand text-white" : "border-hairline-strong bg-surface text-ink-soft hover:border-brand hover:text-brand"
                  }`}
                >
                  {role.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
      {shows("company") && (
        <label className={labelClass}>
          Company / brokerage
          <input name="company" type="text" maxLength={200} autoComplete="organization" className={inputClass} />
        </label>
      )}
      {shows("licence") && (
        <label className={labelClass}>
          Licence or designation <span className="font-normal text-ink-faint">(if any)</span>
          <input name="licence" type="text" maxLength={200} placeholder="RECO, FSRA, LSO, CPA…" className={inputClass} />
        </label>
      )}
      {shows("message") && (
        <label className={`${labelClass} sm:col-span-2`}>
          Anything else we should know? <span className="font-normal text-ink-faint">(optional)</span>
          <textarea name="message" rows={3} maxLength={2000} placeholder={messagePlaceholder} className={inputClass} />
        </label>
      )}
      <div className="space-y-2 sm:col-span-2">
        {showPartnerBox && (
          <label className="flex items-start gap-2 text-xs leading-relaxed text-ink-soft">
            <input type="checkbox" name="consentPartner" className={checkboxClass} />
            {KEYPR_CONSENT_TEXT}
          </label>
        )}
        <label className="flex items-start gap-2 text-xs leading-relaxed text-ink-faint">
          <input type="checkbox" name="consentMarketing" className={checkboxClass} />
          {marketingLabel}
        </label>
      </div>
      <div className="sm:col-span-2">
        <button type="submit" disabled={status === "submitting"} className={`${primaryButtonClass} w-full sm:w-auto`}>
          {status === "submitting" ? "Sending…" : submitLabel}
        </button>
        {error && (
          <p role="alert" className="mt-2 text-xs font-medium text-bad">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}

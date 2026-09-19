/**
 * Small client-side pieces shared by the sign-in and account forms: one JSON
 * request helper that always resolves to either data or a sentence a person
 * can read, the form control classes, and a date label that renders the same
 * on the server and in the browser.
 */

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const GENERIC_ERROR = "Something went wrong. Please try again.";
const OFFLINE_ERROR = "We couldn't reach Realist. Check your connection and try again.";

export async function requestJson<T = { ok: true }>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    return { ok: false, status: 0, error: OFFLINE_ERROR };
  }
  const payload = (await response.json().catch(() => null)) as
    | ({ ok?: boolean; error?: string } & Record<string, unknown>)
    | null;
  if (!response.ok || !payload || payload.ok === false) {
    return { ok: false, status: response.status, error: payload?.error || GENERIC_ERROR };
  }
  return { ok: true, data: payload as T };
}

const inputBase =
  "mt-1 w-full rounded-[3px] border border-hairline-strong px-3 py-2.5 text-sm placeholder:text-ink-faint focus:border-brand focus:outline-none disabled:opacity-60";
export const inputClass = `${inputBase} bg-surface text-ink`;
/** A value shown for reference that can't be edited here. */
export const readOnlyInputClass = `${inputBase} bg-paper text-ink-soft`;
export const labelClass = "block text-xs font-medium text-ink-soft";
export const eyebrowClass = "tnum text-[10px] font-medium uppercase tracking-[1.3px]";
export const primaryButtonClass =
  "rounded-[3px] bg-brand px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-60";
export const secondaryButtonClass =
  "rounded-[3px] border border-hairline-strong bg-surface px-4 py-3 text-sm font-semibold text-ink transition-colors hover:border-brand hover:text-brand disabled:opacity-60";
export const checkboxClass = "mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--color-brand)]";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "Sep 18, 2026". Built from numeric parts in a fixed zone, because month
 * abbreviations differ between Node's and the browser's locale data and a
 * mismatch would break hydration.
 */
export function formatDay(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const month = MONTHS[read("month") - 1];
  return month ? `${month} ${read("day")}, ${read("year")}` : "";
}

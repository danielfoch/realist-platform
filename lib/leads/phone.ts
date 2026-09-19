/**
 * North American numbers to E.164 — what the CRM and the brokerage partner
 * both expect. Anything that doesn't look like one is returned as typed, so a
 * person's number is never thrown away over formatting.
 */
export function toE164(raw: string | null | undefined): string | null {
  const typed = raw?.trim();
  if (!typed) return null;
  const digits = typed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (typed.startsWith("+") && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return typed.slice(0, 40);
}

export function isE164(value: string | null | undefined): boolean {
  return Boolean(value && /^\+[1-9]\d{7,14}$/.test(value));
}

export function splitName(name: string | null | undefined, email: string): { first: string; last: string } {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length > 0) return { first: parts[0], last: parts.slice(1).join(" ") };
  // No name given: the CRM still needs something to show in a list.
  const local = email.split("@")[0] ?? "";
  const guess = local.split(/[._-]+/).filter((part) => /^[a-z]+$/i.test(part));
  const cap = (word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  return { first: guess[0] ? cap(guess[0]) : "", last: guess[1] ? cap(guess[1]) : "" };
}

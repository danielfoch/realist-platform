export function fmtMoney(value: number | null | undefined, compact = false): string {
  if (value == null || !isFinite(value)) return "—";
  if (compact && Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toLocaleString("en-CA", { maximumFractionDigits: 2 })}M`;
  }
  if (compact && Math.abs(value) >= 10_000) {
    return `$${Math.round(value / 1000).toLocaleString("en-CA")}K`;
  }
  return value.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  });
}

export function fmtPct(value: number | null | undefined, digits = 1): string {
  if (value == null || !isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function fmtNum(value: number | null | undefined, digits = 0): string {
  if (value == null || !isFinite(value)) return "—";
  return value.toLocaleString("en-CA", { maximumFractionDigits: digits });
}

export function fmtSqft(value: number | null | undefined): string {
  if (value == null || !isFinite(value)) return "—";
  return `${Math.round(value).toLocaleString("en-CA")} sf`;
}

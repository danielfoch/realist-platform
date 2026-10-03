import { z } from "zod";

export const requestSchema = z.object({
  address: z.string().trim().min(5).max(240).optional(),
  city: z.string().trim().min(2).max(80).optional(),
  province: z.string().trim().min(2).max(40).optional(),
  lat: z.number().finite().min(41).max(84).optional(),
  lng: z.number().finite().min(-142).max(-52).optional(),
}).strict().superRefine((v, ctx) => {
  if ((v.lat === undefined) !== (v.lng === undefined)) ctx.addIssue({ code: "custom", message: "Supply both lat and lng." });
  if (!v.address && v.lat === undefined) ctx.addIssue({ code: "custom", message: "Supply a Canadian civic address with its city, or lat and lng." });
  if (v.address && /[\x00-\x1f*%]/.test(v.address)) ctx.addIssue({ code: "custom", message: "Address must be plain text without wildcards or control characters." });
});
export type PropertyRequest = z.infer<typeof requestSchema>;
export type Row = Record<string, unknown>;
export type Status = "available" | "no_match" | "not_supported" | "not_loaded" | "unavailable" | "ambiguous" | "skipped";
export interface Source {
  id: string;
  name: string;
  url: string;
  licence: string;
  attribution: string;
  licenceUrl?: string;
}
export interface Layer<T = unknown> {
  status: Status;
  data: T | null;
  source: Source | null;
  retrievedAt: string | null;
  sourceUpdatedAt: string | null;
  importedAt?: string | null;
  note: string | null;
  truncated?: boolean;
}
export function layer(status: Status, data?: null, source?: Source | null, note?: string | null, sourceUpdatedAt?: string | null): Layer<never>;
export function layer<T>(status: Status, data: T, source?: Source | null, note?: string | null, sourceUpdatedAt?: string | null): Layer<T>;
export function layer(status: Status, data: unknown = null, source: Source | null = null, note: string | null = null, sourceUpdatedAt: string | null = null): Layer {
  return { status, data, source, retrievedAt: source && ["available", "no_match", "ambiguous"].includes(status) ? new Date().toISOString() : null, sourceUpdatedAt, note };
}
export const text = (v: unknown): string | null => typeof v === "string" && v.trim() ? v.trim() : null;
export const number = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "" || (typeof v === "string" && !v.trim())) return null;
  if (typeof v !== "number" && typeof v !== "string") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
export const publishedYear = (v: unknown): number | null => {
  const n = number(v);
  return n !== null && Number.isInteger(n) && n >= 1000 && n <= 2100 ? n : null;
};
export function date(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString();
  return text(v);
}
export const fold = (v: string): string => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const aliases: Record<string, string> = { st: "street", ave: "avenue", av: "avenue", blvd: "boulevard", boul: "boulevard", rd: "road", dr: "drive", pl: "place", ct: "court", crt: "court", cres: "crescent", ln: "lane", terr: "terrace", ch: "chemin", rte: "route", n: "north", s: "south", e: "east", w: "west", ne: "northeast", nw: "northwest", se: "southeast", sw: "southwest", o: "ouest" };
export function streetKey(address: string): string {
  return fold(address.split(",")[0]).replace(/[.]/g, "").replace(/\b\w+\b/g, (w) => aliases[w] ?? w).replace(/\s+/g, " ").trim();
}
export function civicStreetKey(address: string): string {
  const tokens = fold(address.split(",")[0]).replace(/[-'’]/g, " ").replace(/\./g, "").split(/\s+/);
  // St John / St-Denis means Saint; the suffix in Queen St W means Street.
  const directions = /^(n|s|e|w|ne|nw|se|sw|north|south|east|west|northeast|northwest|southeast|southwest|o|ouest)$/;
  return streetKey(tokens.map((word, i) => word === "st" && tokens[i + 1] && !directions.test(tokens[i + 1]) ? "saint" : word === "ste" ? "sainte" : word).join(" "));
}
export function sameStreet(a: string, b: string): boolean { return civicStreetKey(a) === civicStreetKey(b); }
export function streetNumber(address: string): string | null { return address.trim().match(/^(\d+[a-z]?)\s/i)?.[1] ?? null; }
export function hasUnit(address: string): boolean { return /\b(unit|suite|apt|apartment|app)\b|#|^\d+\s*-\s*\d+/.test(fold(address)); }
export function cityKey(city: string): string { return fold(city).replace(/^(city of|ville de)\s+/, ""); }

/** Matches the existing Realist import key; strict civic-address verification follows every lookup. */
export function importedAddressKey(address: string): string | null {
  const cleaned = fold(address.split(",")[0]).replace(/\bst\b/g, "saint").replace(/\bste\b/g, "sainte").replace(/[^a-z0-9]+/g, " ").trim();
  const m = cleaned.match(/^(\d+[a-z]?)\s+(.+)$/);
  if (!m) return null;
  const words = m[2].split(" ");
  if (words.length > 1 && /^(rue|av|ave|avenue|boul|boulevard|blvd|ch|chemin|rte|route|montee|mtee|pl|place|all|allee|imp|impasse|tsse|terrasse|crt|croissant|prom|promenade|rang|car|carre|cote)$/.test(words[0])) words.shift();
  return `${m[1]} ${words.join(" ")}`;
}

/** Query published abbreviations too; every candidate is still strictly verified. */
export function importedAddressKeys(address: string): string[] {
  let variants = [streetKey(address)];
  for (const [short, full] of Object.entries(aliases)) {
    const pattern = new RegExp(`\\b${full}\\b`, "g");
    const extra = variants.map(v => v.replace(pattern, short));
    variants = [...new Set([...variants, ...extra])].slice(0, 128);
  }
  return [...new Set([importedAddressKey(address), ...variants.map(importedAddressKey)].filter((v): v is string => Boolean(v)))];
}

export interface Location {
  address: string | null; city: string | null; province: string | null;
  latitude: number | null; longitude: number | null; accuracy: string; provider: string;
  addressRegister?: { buildingId: string | null; publishedAddressRecords: number; postalCodes: string[]; buildingUsageCodes: string[]; csduid: string | null; source?: Source; referenceDate?: string };
  municipalAddress?: { recordIds: string[]; community: string | null; permitAddressKeys: string[]; source: Source; sourceUpdatedAt: string | null; publishedRecords?: Row[]; publishedAddressRecordCount?: number; publishedRecordsTruncated?: boolean };
}

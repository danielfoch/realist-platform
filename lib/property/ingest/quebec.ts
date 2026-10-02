/**
 * Québec property assessment roll (rôle d'évaluation foncière) parsing.
 *
 * Source: MAMH open data — one XML file per municipality (1,134 files, ~2.8M
 * assessment units), norme "RL" (schema RL.xsd, version 2.6), CC-BY 4.0 Québec.
 * Index of files: https://donneesouvertes.affmunqc.net/role/indexRole2026.csv
 *
 * Field codes verified against the real 2026 files (RL02010 Sainte-Thérèse-de-
 * Gaspé + spot checks): a CUBF-1000 unit built 2022 carries RL0301A=48.77
 * (frontage m), RL0302A=177977.00 (lot m²), RL0306A=1 (storeys), RL0307A=2022 +
 * RL0307B=R (year built, real), RL0308A=92.3 (floor area m²), RL0311A=1
 * (dwellings), RL0402/0403/0404=35200/179100/214300 (land/building/total $).
 * Vacant land (CUBF 9100) omits the building fields — everything is nullable.
 *
 * Owner blocks (RL0201) are redacted in the open files and are not extracted.
 *
 * These helpers are pure (no I/O): scripts/import-quebec-roll.ts streams the
 * XML and hands each <RLUEx> block to parseRollUnit.
 */

export interface QuebecRollUnit {
  /** Matricule (division-section-emplacement) — unique within a municipality. */
  matricule: string | null;
  lotNumber: string | null;
  civicNumber: string | null;
  civicNumberUpper: string | null;
  streetGenericCode: string | null;
  streetName: string | null;
  /** Assembled display address, e.g. "47 Chemin Saint-Isidore". */
  address: string | null;
  /** CUBF land-use code (1000 = single-family dwelling, 9100 = vacant land…). */
  cubf: string | null;
  frontageM: number | null;
  lotAreaM2: number | null;
  storeys: number | null;
  yearBuilt: number | null;
  /** True when RL0307B = "E" (estimated) rather than "R" (real). */
  yearBuiltEstimated: boolean;
  floorAreaM2: number | null;
  dwellings: number | null;
  marketRefDate: string | null;
  landValue: number | null;
  buildingValue: number | null;
  totalValue: number | null;
  previousRollValue: number | null;
}

export const QUEBEC_ROLL_ATTRIBUTION =
  "Source: Ministère des Affaires municipales et de l'Habitation (Québec), rôles d'évaluation foncière. CC-BY 4.0 Québec.";

/** MAMH street generic codes → display labels (fallback: raw code, title-cased). */
const STREET_GENERIC_LABELS: Record<string, string> = {
  RUE: "Rue",
  AV: "Avenue",
  BOUL: "Boulevard",
  CH: "Chemin",
  RTE: "Route",
  MTEE: "Montée",
  PL: "Place",
  ALL: "Allée",
  IMP: "Impasse",
  TSSE: "Terrasse",
  CRT: "Croissant",
  PROM: "Promenade",
  RANG: "Rang",
  CAR: "Carré",
  COTE: "Côte",
};

const decodeEntities = (s: string): string =>
  s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}>([^<]*)</${name}>`));
  const v = m?.[1]?.trim();
  return v ? decodeEntities(v) : null;
}

function num(xml: string, name: string): number | null {
  const v = tag(xml, name);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s\-'])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());
}

/** Parse one <RLUEx>…</RLUEx> block. Uses the unit's FIRST address/lot entry. */
export function parseRollUnit(unitXml: string): QuebecRollUnit {
  // First address block (a unit can list several; the first is the principal).
  const addrBlock = unitXml.match(/<RL0101x>[\s\S]*?<\/RL0101x>/)?.[0] ?? "";
  const civicNumber = tag(addrBlock, "RL0101Ax");
  const civicNumberUpper = tag(addrBlock, "RL0101Bx");
  const streetGenericCode = tag(addrBlock, "RL0101Ex");
  const streetName = tag(addrBlock, "RL0101Gx");

  let address: string | null = null;
  if (streetName) {
    const generic = streetGenericCode
      ? STREET_GENERIC_LABELS[streetGenericCode] ?? titleCase(streetGenericCode)
      : null;
    address = [civicNumber, generic, titleCase(streetName)].filter(Boolean).join(" ");
  }

  const matriculeParts = [tag(unitXml, "RL0104A"), tag(unitXml, "RL0104B"), tag(unitXml, "RL0104C")];
  const matricule = matriculeParts.every(Boolean) ? matriculeParts.join("-") : null;

  return {
    matricule,
    lotNumber: tag(unitXml.match(/<RL0103x>[\s\S]*?<\/RL0103x>/)?.[0] ?? "", "RL0103Ax"),
    civicNumber,
    civicNumberUpper,
    streetGenericCode,
    streetName,
    address,
    cubf: tag(unitXml, "RL0105A"),
    frontageM: num(unitXml, "RL0301A"),
    lotAreaM2: num(unitXml, "RL0302A"),
    storeys: num(unitXml, "RL0306A"),
    yearBuilt: num(unitXml, "RL0307A"),
    yearBuiltEstimated: tag(unitXml, "RL0307B") === "E",
    floorAreaM2: num(unitXml, "RL0308A"),
    dwellings: num(unitXml, "RL0311A"),
    marketRefDate: tag(unitXml, "RL0401A"),
    landValue: num(unitXml, "RL0402A"),
    buildingValue: num(unitXml, "RL0403A"),
    totalValue: num(unitXml, "RL0404A"),
    previousRollValue: num(unitXml, "RL0405A"),
  };
}

/**
 * Loose matching key: civic number + street NAME only (no street type), lower-
 * cased, accents stripped. DDF listing addresses write street types every
 * which way ("Ch.", "Chemin", missing entirely) — the loose key survives that.
 */
/** "st"/"ste" as standalone words mean Saint/Sainte in Qu\u00e9bec \u2014 expand so
 * "47 St-Isidore" and "47 SAINT-ISIDORE" produce the same key. */
const expandSaint = (s: string): string =>
  s.replace(/\bst\b/g, "saint").replace(/\bste\b/g, "sainte");

export function looseAddressKey(civicNumber: string | null, streetName: string | null): string | null {
  if (!civicNumber || !streetName) return null;
  const name = expandSaint(
    streetName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim(),
  );
  return name ? `${civicNumber.toLowerCase()} ${name}` : null;
}

/** Derive the loose key for a free-form listing address ("47 Ch. St-Isidore"). */
export function looseKeyFromListingAddress(address: string): string | null {
  const cleaned = expandSaint(
    address
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\b(unit|suite|apt|app)\s*\S+/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim(),
  );
  const m = cleaned.match(/^(\d+[a-z]?)\s+(.+)$/);
  if (!m) return null;
  // Drop a leading street-type word so "47 chemin saint isidore" and
  // "47 saint isidore" collide on purpose. ("st"/"ste" are NOT here \u2014 they were
  // already expanded to saint/sainte above.)
  const STREET_TYPES = new Set([
    "rue", "av", "ave", "avenue", "boul", "boulevard", "blvd", "ch", "chemin",
    "rte", "route", "montee", "mtee", "pl", "place", "all", "allee", "imp",
    "impasse", "tsse", "terrasse", "crt", "croissant", "prom", "promenade",
    "rang", "car", "carre", "cote",
  ]);
  const words = m[2].split(" ").filter(Boolean);
  if (words.length > 1 && STREET_TYPES.has(words[0])) words.shift();
  return words.length ? `${m[1]} ${words.join(" ")}` : null;
}

/** Streaming scanner state for pulling <RLUEx> blocks out of arbitrary chunks. */
export function extractUnits(buffer: string): { units: string[]; rest: string } {
  const units: string[] = [];
  let cursor = 0;
  for (;;) {
    const start = buffer.indexOf("<RLUEx>", cursor);
    if (start === -1) break;
    const end = buffer.indexOf("</RLUEx>", start);
    if (end === -1) {
      cursor = start;
      break;
    }
    units.push(buffer.slice(start, end + "</RLUEx>".length));
    cursor = end + "</RLUEx>".length;
  }
  const lastOpen = buffer.indexOf("<RLUEx>", cursor);
  // No open tag left: still keep a small tail in case a "<RLUEx>" tag is split
  // across the chunk boundary.
  const rest = lastOpen === -1 ? buffer.slice(Math.max(cursor, buffer.length - 16)) : buffer.slice(lastOpen);
  return { units, rest };
}

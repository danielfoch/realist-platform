/**
 * Municipal assessment-roll adapters (open data, one mapper per city).
 *
 * The Québec roll (shared/quebecRoll.ts) is bespoke provincial XML; these are
 * single-table Socrata CSV exports, so they get their own lightweight adapter
 * registry (same shape as shared/buildingPermits.ts). Every adapter maps one
 * CSV row → an AssessmentRollRecord that lands in the SAME assessment_units
 * table the Québec roll uses, keyed by (source, municipalityCode, matricule),
 * so getPropertyAssessment stays source-agnostic.
 *
 * Column names + sample values verified against the live Socrata resources
 * (2026-07): Winnipeg d4mq-wa44, Calgary 4bsw-nn7w, Edmonton q7d6-ambg,
 * Nova Scotia / PVSC a859-xvcs (thedatazone.ca).
 * Gotcha carried over from the permits work: Socrata JSON omits null fields, so
 * the importer streams the CSV export (authoritative column set), not the JSON.
 * SECOND gotcha (caught 2026-07): the bulk `/api/views/<id>/rows.csv` export
 * headers are DISPLAY names ("Assessment Account Number"), not the JSON field
 * names — so adapters read the display headers normalized by normalizeHeaderKey.
 */

import { looseKeyFromListingAddress } from "./quebecRoll";

const SQFT_PER_M2 = 10.7639;

/**
 * Normalize a Socrata bulk-CSV-export header cell to the key the adapters read.
 *
 * The `/api/views/<id>/rows.csv` bulk export uses *display* column names
 * ("Assessment Account Number", "Roll Number"), NOT the API field names the
 * `/resource/<id>.json` endpoint returns. Lowercasing alone left spaces in the
 * key, so `row.roll_number` / `row.aan` came back undefined and every row was
 * skipped (NS/Winnipeg/Edmonton imported zero rows). Collapsing whitespace to
 * underscores turns "Roll Number" → `roll_number`, matching the adapter reads.
 * (Calgary's export already uses `ROLL_NUMBER`-style headers, so it is a no-op.)
 */
export function normalizeHeaderKey(name: string): string {
  return name.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/\s+/g, "_");
}

export interface AssessmentRollRecord {
  matricule: string; // per-parcel roll/account number — the upsert key within a city
  /** Per-row municipality override for province-wide sources (NS). Falls back to the adapter name. */
  municipalityName?: string | null;
  address: string | null;
  looseAddressKey: string | null;
  rollYear: number | null;
  cubf: string | null; // land-use / property-use code (city-specific vocabulary)
  frontageM: number | null;
  lotAreaM2: number | null;
  storeys: number | null;
  yearBuilt: number | null;
  yearBuiltEstimated: boolean;
  floorAreaM2: number | null;
  dwellings: number | null;
  marketRefDate: string | null;
  landValue: number | null;
  buildingValue: number | null;
  totalValue: number | null;
  previousRollValue: number | null;
}

export interface AssessmentRollAdapter {
  key: string; // also the `source` and `municipality_code` value
  name: string; // municipality_name
  province: string;
  downloadUrl: string;
  licence: string;
  attribution: string;
  headers?: Record<string, string>;
  mapRow(row: Record<string, string>): AssessmentRollRecord | null;
}

const str = (v: string | undefined): string | null => {
  const t = (v ?? "").trim();
  return t || null;
};

const int = (v: string | undefined): number | null => {
  const t = (v ?? "").trim();
  if (!t) return null;
  const n = Math.round(Number(t)); // Socrata numerics arrive as "1981.0"
  return Number.isFinite(n) ? n : null;
};

const money = (v: string | undefined): number | null => {
  const t = (v ?? "").trim();
  if (!t) return null;
  const n = Math.round(Number(t));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const sqftToM2 = (v: string | undefined): number | null => {
  const t = (v ?? "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? Math.round((n / SQFT_PER_M2) * 10) / 10 : null;
};

const m2 = (v: string | undefined): number | null => {
  const t = (v ?? "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : null;
};

/** Reasonable year-built guard — drops 0 / typos without judging the data. */
const yearBuilt = (v: string | undefined): number | null => {
  const n = int(v);
  return n !== null && n >= 1700 && n <= 2100 ? n : null;
};

function withAddress(address: string | null, rec: Omit<AssessmentRollRecord, "address" | "looseAddressKey">): AssessmentRollRecord {
  return { ...rec, address, looseAddressKey: address ? looseKeyFromListingAddress(address) : null };
}

export const ASSESSMENT_ROLL_ADAPTERS: AssessmentRollAdapter[] = [
  {
    key: "winnipeg",
    name: "Winnipeg",
    province: "Manitoba",
    downloadUrl: "https://data.winnipeg.ca/api/views/d4mq-wa44/rows.csv?accessType=DOWNLOAD",
    licence: "Open Government Licence – Winnipeg",
    attribution: "Contains information licensed under the Open Government Licence – City of Winnipeg.",
    mapRow(row) {
      const matricule = str(row.roll_number);
      if (!matricule) return null;
      return withAddress(str(row.full_address), {
        matricule,
        rollYear: int(row.current_assessment_year),
        cubf: str(row.property_use_code),
        frontageM: null,
        lotAreaM2: sqftToM2(row.assessed_land_area),
        storeys: null,
        yearBuilt: yearBuilt(row.year_built),
        yearBuiltEstimated: false,
        floorAreaM2: sqftToM2(row.total_living_area),
        dwellings: null,
        marketRefDate: str(row.assessment_date)?.slice(0, 10) ?? null,
        landValue: null,
        buildingValue: null,
        totalValue: money(row.total_assessed_value),
        previousRollValue: null,
      });
    },
  },
  {
    key: "calgary",
    name: "Calgary",
    province: "Alberta",
    downloadUrl: "https://data.calgary.ca/api/views/4bsw-nn7w/rows.csv?accessType=DOWNLOAD",
    licence: "City of Calgary Open Data Terms of Use",
    attribution: "Contains information licensed under the Open Data Terms of Use of The City of Calgary.",
    mapRow(row) {
      const matricule = str(row.roll_number);
      if (!matricule) return null;
      return withAddress(str(row.address), {
        matricule,
        rollYear: int(row.roll_year),
        cubf: str(row.land_use_designation), // Calgary Land Use Bylaw district (e.g. R-CG)
        frontageM: null,
        lotAreaM2: m2(row.land_size_sm),
        storeys: null,
        yearBuilt: yearBuilt(row.year_of_construction),
        yearBuiltEstimated: false,
        floorAreaM2: null,
        dwellings: null,
        marketRefDate: null,
        landValue: null,
        buildingValue: null,
        totalValue: money(row.assessed_value),
        previousRollValue: null,
      });
    },
  },
  {
    key: "edmonton",
    name: "Edmonton",
    province: "Alberta",
    downloadUrl: "https://data.edmonton.ca/api/views/q7d6-ambg/rows.csv?accessType=DOWNLOAD",
    licence: "City of Edmonton Open Data Terms of Use",
    attribution: "Source: City of Edmonton — Property Assessment Data (Current Calendar Year), data.edmonton.ca.",
    mapRow(row) {
      const matricule = str(row.account_number);
      if (!matricule) return null;
      const address = [str(row.house_number), str(row.street_name)].filter(Boolean).join(" ") || null;
      return withAddress(address, {
        matricule,
        rollYear: null, // dataset is the current calendar year; no per-row roll_year column
        cubf: str(row.assessment_class_1), // display header "Assessment Class 1" (e.g. RESIDENTIAL)
        frontageM: null,
        lotAreaM2: null,
        storeys: null,
        yearBuilt: null, // not published in the Edmonton assessment dataset
        yearBuiltEstimated: false,
        floorAreaM2: null,
        dwellings: null,
        marketRefDate: null,
        landValue: null,
        buildingValue: null,
        totalValue: money(row.assessed_value),
        previousRollValue: null,
      });
    },
  },
  {
    // Province-wide: PVSC's Socrata portal (thedatazone.ca), NOT data.novascotia.ca.
    // Residential dwelling characteristics (a859-xvcs): address + year built +
    // living area for ~386k NS dwellings. Assessed value lives in a separate
    // multi-year dataset (bt58-qu28) joined on `aan` — a documented follow-up.
    key: "ns-pvsc",
    name: "Nova Scotia",
    province: "Nova Scotia",
    downloadUrl: "https://www.thedatazone.ca/api/views/a859-xvcs/rows.csv?accessType=DOWNLOAD",
    licence: "Open Data and Information Government Licence – PVSC and Participating Municipalities",
    attribution:
      "Contains information from Property Valuation Services Corporation (PVSC), licensed under the Open Data and Information Government Licence – PVSC and Participating Municipalities.",
    headers: { "User-Agent": "Mozilla/5.0 (realist.ca open-data importer; hello@realist.ca)" },
    mapRow(row) {
      // Keys are the bulk-CSV *display* headers, normalized by normalizeHeaderKey
      // ("Assessment Account Number" → assessment_account_number), NOT the
      // /resource JSON field names (aan, address_num) — those differ for PVSC.
      const matricule = str(row.assessment_account_number); // province-unique account number
      if (!matricule) return null;
      const address = [
        str(row.civic_number),
        str(row.civic_direction),
        str(row.civic_street_name),
        str(row.civic_street_suffix),
      ]
        .filter(Boolean)
        .join(" ") || null;
      return {
        ...withAddress(address, {
          matricule,
          rollYear: null,
          cubf: str(row.style),
          frontageM: null,
          lotAreaM2: null, // lot size is in a separate PVSC dataset (wg22-3ric)
          storeys: null,
          yearBuilt: yearBuilt(row.year_built),
          yearBuiltEstimated: false,
          floorAreaM2: sqftToM2(row.square_foot_living_area),
          dwellings: int(row.living_units),
          marketRefDate: null,
          landValue: null,
          buildingValue: null,
          totalValue: null, // assessed value is in bt58-qu28 (aan-joined) — follow-up
          previousRollValue: null,
        }),
        municipalityName: str(row.municipal_unit), // per-row: HRM, CBRM, etc.
      };
    },
  },
];

/** source key → attribution string, so getPropertyAssessment credits the right owner. */
export const ASSESSMENT_ROLL_ATTRIBUTION: Record<string, string> = Object.fromEntries(
  ASSESSMENT_ROLL_ADAPTERS.map((a) => [a.key, a.attribution]),
);

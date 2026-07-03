/**
 * City of Toronto Development Applications (open.toronto.ca, CKAN resource
 * 8907d8ed) → normalized records for the enrichment "development activity"
 * signal. Column names verified against the live datastore dump (2026-07):
 * APPLICATION_TYPE, "APPLICATION#", STATUS, STREET_NUM/NAME/TYPE/DIRECTION, X, Y
 * (MTM Zone 10 — see shared/torontoMtm.ts), DATE_SUBMITTED, DESCRIPTION,
 * WARD_NUMBER/NAME, APPLICATION_URL.
 *
 * Pure module: the importer streams the CSV and calls mapRow per record; the
 * enrichment API reuses these records for the nearby-development signal.
 */

import { mtm10ToLatLng, isWithinToronto } from "./torontoMtm";

export interface DevelopmentApplication {
  applicationNumber: string;
  applicationType: string | null;
  status: string | null;
  address: string | null;
  description: string | null;
  dateSubmitted: string | null; // YYYY-MM-DD
  wardNumber: string | null;
  wardName: string | null;
  applicationUrl: string | null;
  lat: number | null;
  lng: number | null;
}

const str = (v: string | undefined): string | null => {
  const t = (v ?? "").trim();
  return t || null;
};

const num = (v: string | undefined): number | null => {
  const t = (v ?? "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

const isoDate = (v: string | undefined): string | null => {
  const m = (v ?? "").trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
};

/** Reproject MTM10 X/Y; returns null coords if absent or outside Toronto. */
function coords(row: Record<string, string>): { lat: number | null; lng: number | null } {
  const x = num(row.x);
  const y = num(row.y);
  if (x === null || y === null || (x === 0 && y === 0)) return { lat: null, lng: null };
  const ll = mtm10ToLatLng(x, y);
  return isWithinToronto(ll) ? { lat: ll.lat, lng: ll.lng } : { lat: null, lng: null };
}

/**
 * Rows arrive lower-cased by the importer's header normalisation, so the
 * "application#" and "reference_file#" hashes are accessed lower-case here.
 */
export function mapDevelopmentRow(row: Record<string, string>): DevelopmentApplication | null {
  const applicationNumber = str(row["application#"]) ?? str(row.application_number);
  if (!applicationNumber) return null;
  const address =
    [str(row.street_num), str(row.street_name), str(row.street_type), str(row.street_direction)]
      .filter(Boolean)
      .join(" ") || null;
  const { lat, lng } = coords(row);
  return {
    applicationNumber,
    applicationType: str(row.application_type),
    status: str(row.status),
    address,
    description: str(row.description),
    dateSubmitted: isoDate(row.date_submitted),
    wardNumber: str(row.ward_number),
    wardName: str(row.ward_name),
    applicationUrl: str(row.application_url),
    lat,
    lng,
  };
}

export const DEVELOPMENT_APPLICATIONS_ATTRIBUTION =
  "Contains information licensed under the Open Government Licence – Toronto.";

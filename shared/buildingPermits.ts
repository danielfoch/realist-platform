/**
 * Municipal building-permit adapters (open data, one mapper per city).
 *
 * Column shapes verified against the live endpoints (2026-07):
 *   Vancouver — Opendatasoft CSV export of "issued-building-permits"
 *     (permitnumber, issuedate, projectvalue, typeofwork, address,
 *      projectdescription, propertyuse, geo_point_2d "lat, lng")
 *   Calgary  — Socrata c2es-76ed CSV (permitnum, issueddate, statuscurrent,
 *      permittype, workclassgroup, description, housingunits, estprojectcost,
 *      originaladdress, latitude, longitude). NOTE: the JSON API omits null
 *      fields — the CSV header is the authoritative column list.
 *   Montréal — CKAN permis-construction CSV (id_permis, date_emission,
 *      emplacement, arrondissement, description_type_demande, nature_travaux,
 *      nb_logements, latitude, longitude) — no cost column; needs a browser UA.
 *
 * Pure module: the importer streams CSVs and calls mapRow per record; the
 * enrichment API reuses permitLooseKey for listing-address matching.
 */

import { looseKeyFromListingAddress } from "./quebecRoll";

export interface BuildingPermit {
  permitNumber: string;
  city: string;
  province: string;
  address: string | null;
  looseAddressKey: string | null;
  permitType: string | null;
  workType: string | null;
  status: string | null;
  description: string | null;
  units: number | null;
  estimatedValue: number | null;
  issuedDate: string | null; // YYYY-MM-DD
  lat: number | null;
  lng: number | null;
}

export interface PermitCityAdapter {
  key: string;
  name: string;
  province: string;
  downloadUrl: string;
  attribution: string;
  licence: string;
  /** Extra request headers (Montréal rejects the default fetch UA). */
  headers?: Record<string, string>;
  mapRow(row: Record<string, string>): BuildingPermit | null;
}

/**
 * Loose key for a permit address: cut at the first comma (Vancouver appends
 * ", Vancouver, BC V6S 1X5"), drop "#3"-style unit markers, then reuse the
 * roll-side key logic (accents, St→Saint, street types).
 */
export function permitLooseKey(address: string | null | undefined): string | null {
  if (!address) return null;
  const street = address.split(",")[0].replace(/#\S+/g, " ").trim();
  return street ? looseKeyFromListingAddress(street) : null;
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
  const t = (v ?? "").trim();
  const m = t.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
};

/** Opendatasoft geo_point_2d comes as "49.25, -123.14". */
function splitPoint(v: string | undefined): { lat: number | null; lng: number | null } {
  const parts = (v ?? "").split(",").map((p) => Number(p.trim()));
  if (parts.length === 2 && parts.every(Number.isFinite)) return { lat: parts[0], lng: parts[1] };
  return { lat: null, lng: null };
}

function validCoords(lat: number | null, lng: number | null): boolean {
  return lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0);
}

export const PERMIT_CITY_ADAPTERS: PermitCityAdapter[] = [
  {
    key: "vancouver",
    name: "Vancouver",
    province: "British Columbia",
    downloadUrl:
      "https://opendata.vancouver.ca/api/explore/v2.1/catalog/datasets/issued-building-permits/exports/csv?delimiter=%2C",
    attribution: "Contains information licensed under the Open Government Licence – Vancouver.",
    licence: "OGL – Vancouver",
    mapRow(row) {
      const permitNumber = str(row.permitnumber);
      if (!permitNumber) return null;
      const { lat, lng } = splitPoint(row.geo_point_2d);
      const address = str(row.address);
      return {
        permitNumber,
        city: "Vancouver",
        province: "British Columbia",
        address,
        looseAddressKey: permitLooseKey(address),
        permitType: str(row.propertyuse),
        workType: str(row.typeofwork),
        status: null, // dataset only contains issued permits
        description: str(row.projectdescription),
        units: null,
        estimatedValue: num(row.projectvalue),
        issuedDate: isoDate(row.issuedate),
        lat: validCoords(lat, lng) ? lat : null,
        lng: validCoords(lat, lng) ? lng : null,
      };
    },
  },
  {
    key: "calgary",
    name: "Calgary",
    province: "Alberta",
    downloadUrl: "https://data.calgary.ca/resource/c2es-76ed.csv?$limit=1000000",
    attribution: "Contains information licensed under the Open Government Licence – City of Calgary.",
    licence: "OGL – City of Calgary",
    mapRow(row) {
      const permitNumber = str(row.permitnum);
      if (!permitNumber) return null;
      const lat = num(row.latitude);
      const lng = num(row.longitude);
      const address = str(row.originaladdress);
      return {
        permitNumber,
        city: "Calgary",
        province: "Alberta",
        address,
        looseAddressKey: permitLooseKey(address),
        permitType: str(row.permittype),
        workType: str(row.workclassgroup) ?? str(row.workclass),
        status: str(row.statuscurrent),
        description: str(row.description),
        units: num(row.housingunits),
        estimatedValue: num(row.estprojectcost),
        issuedDate: isoDate(row.issueddate),
        lat: validCoords(lat, lng) ? lat : null,
        lng: validCoords(lat, lng) ? lng : null,
      };
    },
  },
  {
    key: "montreal",
    name: "Montréal",
    province: "Québec",
    downloadUrl:
      "https://donnees.montreal.ca/dataset/d90eaf1b-2de8-43f0-923a-27a620ecdf41/resource/5232a72d-235a-48eb-ae20-bb9d501300ad/download/permis-construction.csv",
    attribution: "Source: Ville de Montréal, permis de construction (CC-BY 4.0).",
    licence: "CC-BY 4.0",
    headers: { "User-Agent": "Mozilla/5.0 (realist.ca open-data importer; hello@realist.ca)" },
    mapRow(row) {
      const permitNumber = str(row.id_permis) ?? str(row.no_demande);
      if (!permitNumber) return null;
      const lat = num(row.latitude);
      const lng = num(row.longitude);
      const address = str(row.emplacement)?.replace(/\s+/g, " ") ?? null;
      return {
        permitNumber,
        city: "Montréal",
        province: "Québec",
        address,
        looseAddressKey: permitLooseKey(address),
        permitType: str(row.description_type_batiment),
        workType: str(row.description_type_demande),
        status: null,
        description: str(row.nature_travaux),
        units: num(row.nb_logements),
        estimatedValue: null, // no cost column in the Montréal dataset
        issuedDate: isoDate(row.date_emission),
        lat: validCoords(lat, lng) ? lat : null,
        lng: validCoords(lat, lng) ? lng : null,
      };
    },
  },
];

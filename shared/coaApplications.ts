/**
 * City of Toronto Committee of Adjustment applications (open.toronto.ca,
 * "committee-of-adjustment-applications"): the minor-variance and consent
 * record for a property. This is the ETL/data layer only — the ground-truth
 * substrate that shared/multiplexVarianceRisk.ts is calibrated against (that
 * calibration is a separate effort; here we just land clean, queryable rows).
 *
 * Columns verified against the live CKAN datastore dumps (2026-07):
 *   Closed since 2017 — resource 9c97254e-5460-4799-896f-c7823413c81c (33k rows)
 *   Active            — resource 51fd09cd-99d6-430a-9d42-c24a937b0cb0 (~2.9k)
 * Gotchas: the file number column is literally "REFERENCE_FILE#" (trailing #),
 * and the decision columns are misspelled "C_OF_A_DESCISION" / "OMB_DESCISION".
 * The active resource uses WARD (string) where the closed one uses WARD_NUMBER
 * + WARD_NAME. The dataset is address-only (no coordinates), so listings match
 * by loose address key (shared/quebecRoll.ts looseKeyFromListingAddress), the
 * same key the assessment rolls use.
 */

import { looseKeyFromListingAddress } from "./quebecRoll";

export interface CoaApplication {
  referenceFile: string; // REFERENCE_FILE# — the application file number (upsert key)
  sysId: string | null;
  applicationType: string | null; // MV = minor variance, CO = consent/severance
  subType: string | null;
  workType: string | null;
  status: string | null; // STATUSDESC (e.g. Closed / Open)
  decision: string | null; // C_OF_A_DESCISION (Approved / Refused / Withdrawn / …)
  ombDecision: string | null; // OMB_DESCISION (TLAB/OLT appeal outcome)
  address: string | null;
  looseAddressKey: string | null;
  wardNumber: string | null;
  wardName: string | null;
  zoningReview: string | null;
  zoningDesignation: string | null;
  description: string | null;
  inDate: string | null; // YYYY-MM-DD (application received)
  hearingDate: string | null;
  finalDate: string | null;
  numberOfLotsCreated: number | null;
  applicationUrl: string | null;
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

/**
 * Map one datastore-dump row. Keys arrive lower-cased from the importer's header
 * normalisation, so "REFERENCE_FILE#" is read as "reference_file#" and the
 * misspelled decision columns as-is. Returns null when there's no file number.
 */
export function mapCoaRow(row: Record<string, string>): CoaApplication | null {
  const referenceFile = str(row["reference_file#"]) ?? str(row.reference_file);
  if (!referenceFile) return null;
  // Toronto street direction is a suffix ("GERRARD ST E"), so it goes last —
  // same order the development-applications importer uses, so the loose address
  // keys are assembled consistently across layers.
  const address =
    [str(row.street_num), str(row.street_name), str(row.street_type), str(row.street_direction)]
      .filter(Boolean)
      .join(" ") || null;
  return {
    referenceFile,
    sysId: str(row.sys_id),
    applicationType: str(row.application_type),
    subType: str(row.sub_type),
    workType: str(row.work_type),
    status: str(row.statusdesc),
    decision: str(row.c_of_a_descision), // sic — misspelled in the source
    ombDecision: str(row.omb_descision), // sic
    address,
    looseAddressKey: address ? looseKeyFromListingAddress(address) : null,
    wardNumber: str(row.ward_number) ?? str(row.ward), // active resource uses "ward"
    wardName: str(row.ward_name),
    zoningReview: str(row.zoning_review),
    zoningDesignation: str(row.zoning_designation),
    description: str(row.description),
    inDate: isoDate(row.in_date),
    hearingDate: isoDate(row.hearing_date),
    finalDate: isoDate(row.finaldate),
    numberOfLotsCreated: num(row.number_of_lots_created),
    applicationUrl: str(row.application_url),
  };
}

/** Approved / refused classification (decision text varies; verified 2026-07). */
export function isApproved(decision: string | null): boolean {
  return /approv/i.test(decision ?? ""); // Approved, approved, Approved with Conditions, conditional approval
}
export function isRefused(decision: string | null): boolean {
  return /refus/i.test(decision ?? "");
}

export interface VarianceHistorySummary {
  total: number;
  minorVariances: number; // APPLICATION_TYPE = MV
  consents: number; // APPLICATION_TYPE = CO
  approved: number;
  refused: number;
  withOmbAppeal: number; // an appeal decision was recorded (TLAB/OLT)
  mostRecent: {
    referenceFile: string;
    applicationType: string | null;
    decision: string | null;
    date: string | null;
  } | null;
}

/** Sort key: most recent first by hearing/final/in date (whichever exists). */
function appDate(a: CoaApplication): string {
  return a.hearingDate ?? a.finalDate ?? a.inDate ?? "";
}

/**
 * Pure roll-up over a property's applications — the shape the "variance history"
 * card renders and the substrate the variance-risk calibration reads.
 */
export function summarizeVarianceHistory(apps: CoaApplication[]): VarianceHistorySummary {
  const sorted = [...apps].sort((a, b) => appDate(b).localeCompare(appDate(a)));
  const most = sorted[0] ?? null;
  return {
    total: apps.length,
    minorVariances: apps.filter((a) => a.applicationType === "MV").length,
    consents: apps.filter((a) => a.applicationType === "CO").length,
    approved: apps.filter((a) => isApproved(a.decision)).length,
    refused: apps.filter((a) => isRefused(a.decision)).length,
    withOmbAppeal: apps.filter((a) => a.ombDecision != null).length,
    mostRecent: most
      ? {
          referenceFile: most.referenceFile,
          applicationType: most.applicationType,
          decision: most.decision,
          date: appDate(most) || null,
        }
      : null,
  };
}

export const COA_APPLICATIONS_ATTRIBUTION =
  "Contains information licensed under the Open Government Licence – Toronto.";

/**
 * Realist CRM job helpers — proposed diffs and conflict checks.
 * Realist contacts only. Never invent emails, phones, or names.
 */
import { CRM_CONTACT_STAGES, CRM_CONTACT_TYPES } from "./models/crm";

export const CRM_UPDATE_ACTIONS = [
  "upsert_contact",
  "update_stage",
  "add_note",
  "set_next_action",
] as const;
export type CrmUpdateAction = (typeof CRM_UPDATE_ACTIONS)[number];

export const CRM_MATERIAL_FIELDS = [
  "name",
  "email",
  "phone",
  "stage",
  "contactType",
  "nextAction",
  "nextActionAt",
] as const;

export type CrmSnapshot = {
  id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  stage: string | null;
  contactType: string | null;
  source: string | null;
  targetMarket: string | null;
  nextAction: string | null;
  nextActionAt: string | null;
  lastTouchAt: string | null;
};

export type CrmFieldChange = {
  field: string;
  from: unknown;
  to: unknown;
};

export type CrmProposedDiff = {
  before: CrmSnapshot | null;
  after: CrmSnapshot;
  changes: CrmFieldChange[];
};

export function composeContactName(contact?: {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): string | undefined {
  if (contact?.name?.trim()) return contact.name.trim();
  const parts = [contact?.firstName, contact?.lastName]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.length ? parts.join(" ") : undefined;
}

export function emptyCrmSnapshot(): CrmSnapshot {
  return {
    id: null,
    name: null,
    email: null,
    phone: null,
    stage: null,
    contactType: null,
    source: null,
    targetMarket: null,
    nextAction: null,
    nextActionAt: null,
    lastTouchAt: null,
  };
}

function norm(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

export function buildCrmChanges(before: CrmSnapshot | null, after: CrmSnapshot): CrmFieldChange[] {
  const left = before ?? emptyCrmSnapshot();
  const changes: CrmFieldChange[] = [];
  for (const field of CRM_MATERIAL_FIELDS) {
    if (norm(left[field]) !== norm(after[field])) {
      changes.push({ field, from: left[field], to: after[field] });
    }
  }
  return changes;
}

export function buildCrmDiff(before: CrmSnapshot | null, after: CrmSnapshot): CrmProposedDiff {
  return { before, after, changes: buildCrmChanges(before, after) };
}

/** True when the live row no longer matches the proposed before-state. */
export function crmSnapshotsConflict(expected: CrmSnapshot | null, actual: CrmSnapshot | null): boolean {
  if (!expected && !actual) return false;
  if (!expected || !actual) return true;
  return CRM_MATERIAL_FIELDS.some((field) => norm(expected[field]) !== norm(actual[field]));
}

export { CRM_CONTACT_STAGES, CRM_CONTACT_TYPES };

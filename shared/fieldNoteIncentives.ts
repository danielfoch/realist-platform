/**
 * FN-3 incentive loops — pure logic shared by the server routes and tests.
 *
 * Endorsements are a PRO-to-pro trust signal layered on the existing field-note
 * engine (distinct from the generic member up/down votes that drive `score`):
 * another Power Team professional agrees or disagrees with a note. Agreements
 * reward the author through the same reputation ledger; the counts are also an
 * extra ML label. The lead CTA turns "work with this pro" clicks into attributed
 * crm_contacts leads (the same play PR #43 ran for realtors, for the whole team).
 */

export type EndorsementStance = "agree" | "disagree";

/** A professional endorsement is worth more than a member upvote (2). */
export const ENDORSEMENT_POINTS = 4;

export interface EndorsementResolution {
  action: "added" | "removed" | "changed" | "noop";
  newStance: EndorsementStance | null; // null once removed
  authorPointsDelta: number; // change to the author's reputation ledger
}

/**
 * Endorse-button state machine. Clicking the same stance again toggles it off;
 * a different stance switches it. Only "agree" endorsements carry reputation
 * points, so the delta nets to zero as an endorsement is toggled on and off.
 */
export function resolveEndorsement(
  existing: EndorsementStance | null,
  incoming: EndorsementStance,
): EndorsementResolution {
  const value = (s: EndorsementStance | null) => (s === "agree" ? ENDORSEMENT_POINTS : 0);
  if (existing === incoming) {
    return { action: "removed", newStance: null, authorPointsDelta: value(existing) === 0 ? 0 : -value(existing) };
  }
  if (existing === null) {
    return { action: "added", newStance: incoming, authorPointsDelta: value(incoming) };
  }
  return { action: "changed", newStance: incoming, authorPointsDelta: value(incoming) - value(existing) };
}

export interface FieldNoteLeadInput {
  noteId: string;
  listingMlsNumber: string;
  category: string; // the author's expert category key
  message?: string | null;
}

export interface FieldNoteLeadCrmMapping {
  source: string;
  sourceDetail: string;
  tags: string[];
  data: Record<string, unknown>;
  activityBody: string;
}

/**
 * Map a lead CTA click to the crm_contacts fields (owner = the note's author),
 * so the lead is attributed back to the exact note and listing. Pure so the
 * attribution shape is unit-tested; the route does the upsert.
 */
export function buildFieldNoteLeadCrm(
  input: FieldNoteLeadInput,
  categoryLabel: string,
): FieldNoteLeadCrmMapping {
  const trimmed = input.message?.trim();
  return {
    source: "field_note",
    sourceDetail: `Field-note lead — ${categoryLabel} on listing ${input.listingMlsNumber}`,
    tags: ["field-note-lead", "power-team"],
    data: {
      fieldNoteId: input.noteId,
      listingMlsNumber: input.listingMlsNumber,
      category: input.category,
    },
    activityBody:
      `Investor requested to work with this ${categoryLabel} via a field note on listing ${input.listingMlsNumber}.` +
      (trimmed ? ` Message: "${trimmed}"` : ""),
  };
}

export interface FieldNoteLeadCopy {
  subjectLine: string;
  previewText: string;
  reasonText: string;
}

/**
 * Email/inbox copy for the "a lead arrived" notification to the note's author.
 * Pure so the copy is unit-tested; the queue function adds recipient plumbing.
 */
export function buildFieldNoteLeadCopy(input: {
  leadName: string;
  listingLabel: string; // e.g. "MLS C7891234 (Toronto)"
  message?: string | null;
}): FieldNoteLeadCopy {
  const name = input.leadName.trim() || "An investor";
  const msg = input.message?.trim();
  const excerpt = msg && msg.length > 140 ? `${msg.slice(0, 139).trimEnd()}…` : msg;
  return {
    subjectLine: `New lead: ${name} wants to work with you`,
    previewText: `From your field note on ${input.listingLabel}`,
    reasonText:
      `${name} asked to work with you via your field note on ${input.listingLabel}. ` +
      `They're in your Realist CRM now — reach out while it's warm.` +
      (excerpt ? ` Their message: "${excerpt}"` : ""),
  };
}

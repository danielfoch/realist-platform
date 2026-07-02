// Field-note social layer — pure logic for note validation, vote score math,
// and vote-notification threshold decisions. No DB, no I/O (mirrors the style
// of contributorReputation.ts so it can be unit-tested and shared with the
// client for form validation).
//
// Two author tiers write field notes:
//  - "expert": approved industry partners (existing behaviour — long-form
//    professional notes, multiple per listing).
//  - "member": any signed-in user (short notes, ONE per listing, editable).
//
// Moderation note: there is intentionally no profanity filter yet — notes are
// author-deletable and admin-hideable, which is the agreed minimum for v1.

export type FieldNoteAuthorTier = "expert" | "member";

export const FIELD_NOTE_LIMITS = {
  /** Minimum meaningful note length (both tiers). */
  MIN_LENGTH: 10,
  /** Regular signed-in members: short field notes. */
  MEMBER_MAX_LENGTH: 500,
  /** Approved industry experts keep the original long-form allowance. */
  EXPERT_MAX_LENGTH: 4000,
} as const;

export function fieldNoteMaxLength(tier: FieldNoteAuthorTier): number {
  return tier === "expert" ? FIELD_NOTE_LIMITS.EXPERT_MAX_LENGTH : FIELD_NOTE_LIMITS.MEMBER_MAX_LENGTH;
}

export type FieldNoteValidation =
  | { ok: true; body: string }
  | { ok: false; error: string };

/** Trim + length-check a note body for the given author tier. */
export function validateFieldNoteBody(body: unknown, tier: FieldNoteAuthorTier): FieldNoteValidation {
  const trimmed = typeof body === "string" ? body.trim() : "";
  if (trimmed.length < FIELD_NOTE_LIMITS.MIN_LENGTH) {
    return { ok: false, error: "Add at least a sentence of insight" };
  }
  const max = fieldNoteMaxLength(tier);
  if (trimmed.length > max) {
    return { ok: false, error: `Keep your note under ${max.toLocaleString()} characters` };
  }
  return { ok: true, body: trimmed };
}

// ---------------------------------------------------------------------------
// Vote score math (toggle semantics: one row per user per note, value -1/0/1)
// ---------------------------------------------------------------------------

export type VoteValue = -1 | 0 | 1;

export function isVoteValue(value: unknown): value is VoteValue {
  return value === -1 || value === 0 || value === 1;
}

/**
 * Net score change when a user's vote moves from `previous` to `next`.
 * New upvote: 0→1 = +1. Toggle off: 1→0 = -1. Flip: 1→-1 = -2. No-op: 0.
 */
export function voteDelta(previous: VoteValue, next: VoteValue): number {
  return next - previous;
}

/** Denormalized note score after a vote transition. */
export function scoreAfterVote(currentScore: number, previous: VoteValue, next: VoteValue): number {
  return currentScore + voteDelta(previous, next);
}

// ---------------------------------------------------------------------------
// Vote-notification threshold decisions
// ---------------------------------------------------------------------------

export type NoteVoteMilestone = "first_upvote" | "score_5" | "score_10" | "first_downvote";

/** Ascending net-score thresholds that trigger an author notification. */
export const NOTE_VOTE_UP_THRESHOLDS = [1, 5, 10] as const;
/** Net score at/below which the "first downvote" notification fires. */
export const NOTE_VOTE_DOWN_THRESHOLD = -1;

const UP_MILESTONES: Record<number, NoteVoteMilestone> = {
  1: "first_upvote",
  5: "score_5",
  10: "score_10",
};

/**
 * Decide whether a net-score transition crosses a notification threshold.
 * Returns the single highest milestone crossed (a 0→5 jump reports score_5,
 * not first_upvote) or null when nothing was crossed. Re-crossing a threshold
 * (e.g. 5→4→5) reports again — daily batching is handled by the dedupe key,
 * not here.
 */
export function decideNoteVoteMilestone(previousScore: number, newScore: number): NoteVoteMilestone | null {
  if (newScore > previousScore) {
    for (let i = NOTE_VOTE_UP_THRESHOLDS.length - 1; i >= 0; i--) {
      const threshold = NOTE_VOTE_UP_THRESHOLDS[i];
      if (previousScore < threshold && newScore >= threshold) return UP_MILESTONES[threshold];
    }
    return null;
  }
  if (newScore < previousScore) {
    if (previousScore > NOTE_VOTE_DOWN_THRESHOLD && newScore <= NOTE_VOTE_DOWN_THRESHOLD) {
      return "first_downvote";
    }
  }
  return null;
}

/**
 * Dedupe key batching vote notifications to max ONE per note per UTC day
 * (the notification_queue dedupe unique index drops later inserts). The
 * milestone is intentionally NOT part of the key.
 */
export function noteVoteDedupeKey(noteId: string, at: Date = new Date()): string {
  return `note_vote_update:${noteId}:${at.toISOString().slice(0, 10)}`;
}

export interface NoteVoteCopyInput {
  milestone: NoteVoteMilestone;
  score: number;
  listingLabel: string;
  noteExcerpt?: string | null;
}

export interface NoteVoteCopy {
  subjectLine: string;
  reasonText: string;
  previewText: string;
}

/** Short, consent-friendly copy (well under the 120-word email budget). */
export function buildNoteVoteCopy(input: NoteVoteCopyInput): NoteVoteCopy {
  const excerpt = input.noteExcerpt ? ` — "${input.noteExcerpt}"` : "";
  switch (input.milestone) {
    case "first_upvote":
      return {
        subjectLine: `Your field note on ${input.listingLabel} got its first upvote`,
        reasonText: `An investor found your field note on ${input.listingLabel} useful${excerpt}. It now sits at a score of ${input.score}.`,
        previewText: "Your field note just earned its first upvote.",
      };
    case "score_5":
      return {
        subjectLine: `Your field note on ${input.listingLabel} hit a score of 5`,
        reasonText: `Your field note on ${input.listingLabel}${excerpt} crossed a net score of 5 — the community is leaning on your insight.`,
        previewText: "Your field note crossed a score of 5.",
      };
    case "score_10":
      return {
        subjectLine: `Your field note on ${input.listingLabel} hit a score of 10`,
        reasonText: `Your field note on ${input.listingLabel}${excerpt} crossed a net score of 10 and is now one of the top notes on this listing.`,
        previewText: "Your field note crossed a score of 10.",
      };
    case "first_downvote":
      return {
        subjectLine: `Community pushback on your ${input.listingLabel} field note`,
        reasonText: `Your field note on ${input.listingLabel}${excerpt} was downvoted into negative territory (score ${input.score}). A quick edit or reply can turn that around.`,
        previewText: "Your field note picked up a downvote.",
      };
  }
}

/** Truncate a note body for notification copy. */
export function noteExcerpt(body: string | null | undefined, maxLength = 80): string | null {
  if (!body) return null;
  const collapsed = body.replace(/\s+/g, " ").trim();
  if (!collapsed) return null;
  if (collapsed.length <= maxLength) return collapsed;
  return `${collapsed.slice(0, maxLength - 1).trimEnd()}…`;
}

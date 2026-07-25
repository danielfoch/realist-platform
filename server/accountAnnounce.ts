/**
 * One place that announces a new account: push to the CRM, email the team.
 *
 * There are seven `db.insert(users)` sites across the codebase (auth signup,
 * magic-link, OAuth, lead auto-enrolment, event ticketing, event growth, admin
 * CSV import) and they had wildly inconsistent follow-through — signup pushed to
 * GHL two different ways and emailed nobody, while autoEnrollLeadAsUser, which
 * silently creates an account for every captured lead, did neither.
 *
 * Both side effects live behind one call so a new creation path cannot pick up
 * half of it. Fire-and-forget and never throws: an account must not fail to
 * exist because a CRM webhook timed out.
 */

import { pushContactToGHL } from "./ghl-service";
import { sendNewAccountNotification } from "./resend";

/** How the account came to exist. Appears in the CRM tag and the email. */
export type AccountSource =
  | "signup"
  | "google_oauth"
  | "magic_link"
  | "lead_enrol"
  | "event_ticket"
  | "event_growth"
  | "admin_import";

export interface NewAccountAnnouncement {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  source: AccountSource;
  /** Lead source when the account came from lead capture. */
  leadSource?: string | null;
}

/**
 * Announce a newly created account.
 *
 * Only call this when the account is genuinely new — every caller already knows
 * (`isNew` from the enrolment helpers, or the insert path itself). Announcing on
 * every login would page the team constantly and pollute the CRM.
 *
 * Admin CSV imports pass notifyTeam: false: a 500-row import is one deliberate
 * act by the person who would receive the mail, not 500 revenue events.
 */
export function announceNewAccount(
  account: NewAccountAnnouncement,
  opts: { notifyTeam?: boolean; pushToCrm?: boolean } = {},
): void {
  const notifyTeam = opts.notifyTeam ?? true;
  const pushToCrm = opts.pushToCrm ?? true;

  if (pushToCrm) {
    pushContactToGHL({
      // GHLContact takes plain strings, not optionals — empty string is how every
      // existing call site signals "not provided".
      email: account.email,
      firstName: account.firstName || "",
      lastName: account.lastName || "",
      phone: account.phone || "",
      tags: [
        "realist.ca",
        "realist_account",
        `account_source_${account.source}`,
        `signup-${new Date().toISOString().slice(0, 7)}`,
      ],
      source: account.leadSource || `realist_${account.source}`,
    }).catch(err =>
      console.error(`[account-announce] GHL push failed for ${account.email}:`, err?.message ?? err),
    );
  }

  if (notifyTeam) {
    sendNewAccountNotification({
      email: account.email,
      firstName: account.firstName,
      lastName: account.lastName,
      phone: account.phone,
      source: account.source,
      leadSource: account.leadSource,
    }).catch(err =>
      console.error(`[account-announce] team notification failed for ${account.email}:`, err?.message ?? err),
    );
  }
}

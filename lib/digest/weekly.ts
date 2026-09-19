/**
 * The Monday note: where you stand, what keeps your streak alive, who's ahead
 * of you, and the next meetup near you. Pure composition — the cron in
 * app/api/cron/digest does the querying and sending.
 *
 * It is a commercial electronic message under CASL: it goes only to members
 * who consented, names the sender with a postal address, and carries a working
 * unsubscribe link. composeWeeklyDigest refuses to produce one without them.
 */

import { SITE_BASE_URL } from "@/lib/brand";

export interface DigestInput {
  firstName: string | null;
  stats: { deals: number; thisWeek: number; streakWeeks: number; score: number };
  /** Deals logged in the week that just ended. */
  lastWeekDeals: number;
  /** Rank on last week's board, if ranked. */
  lastWeekRank: number | null;
  /** The name and deal count of whoever is directly ahead, if anyone. */
  ahead: { name: string; deals: number } | null;
  board: Array<{ rank: number; name: string; city: string | null; deals: number }>;
  badge: { name: string; next: { name: string; at: number } | null } | null;
  meetup: { title: string; when: string } | null;
  /** Active listings inside the member's learned buy box that they haven't looked at. */
  fits?: Array<{ street: string; city: string; price: number; netYield: number | null; url: string; brokerage: string }>;
  unsubscribeUrl: string;
  postalAddress: string;
}

export interface ComposedEmail {
  subject: string;
  text: string;
  html: string;
}

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export function digestSubject(input: Pick<DigestInput, "lastWeekDeals" | "lastWeekRank" | "stats">): string {
  if (input.lastWeekRank && input.lastWeekRank <= 3) return `You finished #${input.lastWeekRank} on Realist last week`;
  if (input.lastWeekRank) return `#${input.lastWeekRank} last week — the board just reset`;
  if (input.stats.streakWeeks >= 2) return `Your ${input.stats.streakWeeks}-week streak is on the line`;
  return "The board just reset — one deal puts you on it";
}

/** The one sentence that tells the person what to do this week. */
export function digestNudge(input: Pick<DigestInput, "stats" | "ahead" | "badge" | "lastWeekDeals">): string {
  const { stats, ahead, badge } = input;
  if (badge?.next && badge.next.at - stats.deals <= 3) {
    return `${plural(badge.next.at - stats.deals, "more deal")} and you're ${/^[aeiou]/i.test(badge.next.name) ? "an" : "a"} ${badge.next.name}.`;
  }
  if (stats.streakWeeks >= 2) return `Underwrite one deal this week and your streak becomes ${stats.streakWeeks + 1} weeks.`;
  if (ahead) return `${ahead.name} finished just ahead of you with ${plural(ahead.deals, "deal")}. The board is empty again — go first.`;
  return "Everyone starts this week at zero. One underwrite puts you on the board.";
}

export function composeWeeklyDigest(input: DigestInput): ComposedEmail {
  if (!input.unsubscribeUrl || !input.postalAddress.trim()) {
    throw new Error("A digest needs an unsubscribe link and a postal address.");
  }
  const hello = input.firstName ? `${input.firstName},` : "Hi,";
  const standing =
    input.lastWeekDeals > 0
      ? `Last week you underwrote ${plural(input.lastWeekDeals, "deal")}${input.lastWeekRank ? ` and finished #${input.lastWeekRank}` : ""}. All time: ${plural(input.stats.deals, "deal")}, ${input.stats.score} points.`
      : `You sat last week out. All time you've underwritten ${plural(input.stats.deals, "deal")}.`;
  const nudge = digestNudge(input);
  const boardLines = input.board.slice(0, 5).map((row) => `${row.rank}. ${row.name}${row.city ? ` (${row.city})` : ""} — ${plural(row.deals, "deal")}`);
  const fits = (input.fits ?? []).slice(0, 3);
  const fitLine = (fit: NonNullable<DigestInput["fits"]>[number]) =>
    `${fit.street}, ${fit.city} — $${Math.round(fit.price).toLocaleString("en-CA")}${fit.netYield != null ? ` · ${fit.netYield.toFixed(1)}% net yield` : ""} · Courtesy of ${fit.brokerage}`;
  // Listing content carries CREA's marks wherever it appears, email included.
  const ddfLine = "MLS® listing content powered by the REALTOR.ca Data Distribution Facility (DDF®). MLS®, REALTOR® and associated logos are trademarks of CREA.";
  const listings = `${SITE_BASE_URL}/listings`;
  const leaderboard = `${SITE_BASE_URL}/community/leaderboard`;

  const text = [
    hello,
    "",
    standing,
    nudge,
    "",
    `Find a deal to underwrite: ${listings}`,
    "",
    fits.length ? `New in your buy box (${fits.length}):` : null,
    ...fits.flatMap((fit) => [fitLine(fit), `${SITE_BASE_URL}${fit.url}`]),
    fits.length ? "" : null,
    boardLines.length ? "Last week's top five:" : null,
    ...boardLines,
    boardLines.length ? `The full board: ${leaderboard}` : null,
    input.meetup ? "" : null,
    input.meetup ? `Near you: ${input.meetup.title}, ${input.meetup.when}. ${SITE_BASE_URL}/community` : null,
    "",
    "—",
    fits.length ? ddfLine : null,
    `Realist · ${input.postalAddress.trim()}`,
    `You're getting this because you asked for Realist updates. Unsubscribe: ${input.unsubscribeUrl}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const html = `<div style="font-family:Inter,Arial,sans-serif;color:#242424;font-size:15px;line-height:1.6;max-width:520px">
  <p style="font-size:18px;font-weight:600;margin:0 0 16px">realist<span style="color:#ff334b">.</span></p>
  <p style="margin:0 0 12px">${escapeHtml(hello)}</p>
  <p style="margin:0 0 8px">${escapeHtml(standing)}</p>
  <p style="margin:0 0 20px;font-weight:600">${escapeHtml(nudge)}</p>
  <p style="margin:0 0 28px"><a href="${listings}" style="background:#be1730;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 18px;border-radius:3px;display:inline-block">Find a deal to underwrite</a></p>
  ${
    fits.length
      ? `<p style="font-size:11px;letter-spacing:1.3px;text-transform:uppercase;color:#696969;margin:0 0 6px">New in your buy box</p>
  ${fits.map((fit) => `<p style="margin:0 0 8px;font-size:14px"><a href="${SITE_BASE_URL}${fit.url}" style="color:#be1730;font-weight:600">${escapeHtml(fit.street)}, ${escapeHtml(fit.city)}</a><br><span style="color:#4d4d4d">$${Math.round(fit.price).toLocaleString("en-CA")}${fit.netYield != null ? ` · ${fit.netYield.toFixed(1)}% net yield` : ""} · Courtesy of ${escapeHtml(fit.brokerage)}</span></p>`).join("\n  ")}
  <p style="margin:0 0 24px"></p>`
      : ""
  }
  ${
    boardLines.length
      ? `<p style="font-size:11px;letter-spacing:1.3px;text-transform:uppercase;color:#696969;margin:0 0 6px">Last week's top five</p>
  ${boardLines.map((line) => `<p style="margin:0 0 4px;font-size:14px">${escapeHtml(line)}</p>`).join("\n  ")}
  <p style="margin:10px 0 24px;font-size:14px"><a href="${leaderboard}" style="color:#be1730">The full board →</a></p>`
      : ""
  }
  ${
    input.meetup
      ? `<p style="font-size:11px;letter-spacing:1.3px;text-transform:uppercase;color:#696969;margin:0 0 6px">Near you</p>
  <p style="margin:0 0 24px;font-size:14px">${escapeHtml(input.meetup.title)} — ${escapeHtml(input.meetup.when)}. <a href="${SITE_BASE_URL}/community" style="color:#be1730">Save your spot →</a></p>`
      : ""
  }
  <p style="border-top:1px solid #dadada;padding-top:14px;margin:0;font-size:12px;line-height:1.6;color:#696969">${fits.length ? `${escapeHtml(ddfLine)}<br><br>` : ""}Realist · ${escapeHtml(input.postalAddress.trim())}<br>You're getting this because you asked for Realist updates. <a href="${input.unsubscribeUrl}" style="color:#696969">Unsubscribe</a></p>
</div>`;

  return { subject: digestSubject(input), text, html };
}

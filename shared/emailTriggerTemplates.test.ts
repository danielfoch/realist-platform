/**
 * Template-parity pins for the email-trigger builders moved out of
 * server/emailQueue.ts into shared/emailTriggerTemplates.ts (transport
 * consolidation). The sha256 hashes below were captured from the ORIGINAL
 * server/emailQueue.ts buildEmailForTrigger with the same fixed environment
 * (SESSION_SECRET="parity-test-secret", REPLIT_DOMAINS unset), so a passing
 * suite proves the moved builders are byte-identical to the pre-move code.
 *
 * If you intentionally change a template, re-capture: render
 * buildEmailForTrigger(type, getSampleTriggerPayload(type)) under the env
 * above and update the subject/hash/length rows.
 */

import { describe, expect, it } from "vitest";
import { createHash } from "crypto";

// The unsubscribe secret is captured at module load — pin the env BEFORE the
// dynamic import so nudge unsubscribe tokens are deterministic.
process.env.SESSION_SECRET = "parity-test-secret";
delete process.env.REPLIT_DOMAINS;

const { buildEmailForTrigger, getSampleTriggerPayload, EMAIL_TRIGGER_TYPES } =
  await import("./emailTriggerTemplates");

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

// [subject, htmlSha256, htmlLength, audience, defaultTo] captured pre-move.
const BASELINE: Record<string, [string, string, number, "lead" | "team", string[]]> = {
  deal_submitted_confirmation: [
    "Deal Desk: We received your submission — 123 Maple Avenue, Toronto, ON",
    "7919768bb7631ce35d7110951c85bec9994d4b7ae2538086a400b7707195a7e9",
    3165, "lead", ["jordan.sample@example.com"],
  ],
  hot_lead_immediate_followup: [
    "🔥 HOT LEAD (78pts): Jordan Sample — 123 Maple Avenue, Toronto, ON",
    "56e530c27de2ec4d042e3cacf8195b513ee5f4fc8e2ea918b03fe1b747260d83",
    4268, "team", [],
  ],
  warm_lead_24h_followup: [
    "Warm Lead 24h Follow-up: Jordan Sample — 123 Maple Avenue, Toronto, ON",
    "2eadde3476314421f730779dea5c5dc4c5e72daac764581c410149163b947485",
    3880, "team", [],
  ],
  warm_lead_user_nudge: [
    "Your deal on 123 Maple Avenue, Toronto, ON — ready to talk numbers?",
    "e49e594681d8c383a1548fe804d4573a9beb86fa0fe9f63305da20a882a0af32",
    3567, "lead", ["jordan.sample@example.com"],
  ],
  financing_interest_followup: [
    "💰 Financing Request: Jordan Sample — 123 Maple Avenue, Toronto, ON",
    "d268ed63563be6a82b77e9b9efc62af2ea16496c3055544139963c7af8f4c9ef",
    3963, "team", [],
  ],
  lost_reason_nurture: [
    "Deal Lost: Jordan Sample — Went with another lender",
    "b7a585de8c30e1aa396ced117a357d13b5a029d9a7f1e9395ecb190e54fefe61",
    2878, "team", ["jordan.sample@example.com"],
  ],
  sla_breach_nag: [
    "Hot lead waiting: Jordan Sample — uncontacted past SLA",
    "640622fe6e1849ddf0f94acf2bf0823bba8dd02fc3d8682e4c96c1e9ba35a71c",
    3962, "team", [],
  ],
  saved_deal_no_submit: [
    "Ready to take the next step on 123 Maple Avenue, Toronto, ON?",
    "2e8fdb12d1a27cba7e2bfae720b9664270d7828bd58fef3458ee7706135c2a8f",
    1099, "lead", ["jordan.sample@example.com"],
  ],
  abandoned_underwriting: [
    "Finish your analysis on 123 Maple Avenue, Toronto, ON — the numbers are waiting",
    "586178ef4484fa4813592b8a364bd0482c3ec0ff7b66e5655094eda6198412c2",
    958, "lead", ["jordan.sample@example.com"],
  ],
  financing_interest: [
    "Financing options for 123 Maple Avenue, Toronto, ON — let's talk numbers",
    "49ec1d00f2bd2885388c4db0261beb6f14641c909d064c679a52850b44b5df2f",
    1090, "lead", ["jordan.sample@example.com"],
  ],
  watchlist_price_change: [
    "123 Maple Avenue dropped from $869,000 to $849,000",
    "0e9f77877a7e53448215e1fdbc659036fb35564b5136b69dfb16649a79f9be92",
    1129, "lead", ["jordan.sample@example.com"],
  ],
  saved_search_matches: [
    '3 new Edmonton listings match "Edmonton multiplexes under $900k"',
    "2aa4631cd37f1629b1e3aa0475ebcae66a745ba7a3879a2d560004802cb4c077",
    1132, "lead", ["jordan.sample@example.com"],
  ],
};

describe("emailTriggerTemplates parity (moved from server/emailQueue.ts)", () => {
  it("covers every trigger type with a baseline pin", () => {
    expect(Object.keys(BASELINE).sort()).toEqual([...EMAIL_TRIGGER_TYPES].sort());
  });

  for (const type of EMAIL_TRIGGER_TYPES) {
    it(`renders ${type} byte-identically to the pre-move builder`, () => {
      const [subject, htmlHash, htmlLength, audience, defaultTo] = BASELINE[type];
      const rendered = buildEmailForTrigger(type, getSampleTriggerPayload(type));
      expect(rendered.subject).toBe(subject);
      expect(rendered.audience).toBe(audience);
      expect(rendered.defaultTo).toEqual(defaultTo);
      expect(rendered.html.length).toBe(htmlLength);
      expect(sha256(rendered.html)).toBe(htmlHash);
    });
  }

  it("throws on unknown trigger types (unchanged contract)", () => {
    expect(() => buildEmailForTrigger("nonexistent_type", {})).toThrow(
      "Unknown trigger type: nonexistent_type",
    );
  });

  it("keeps the CASL unsubscribe link in user-facing nudges", () => {
    for (const type of ["saved_deal_no_submit", "abandoned_underwriting", "financing_interest", "watchlist_price_change", "saved_search_matches"] as const) {
      const { html } = buildEmailForTrigger(type, getSampleTriggerPayload(type));
      expect(html).toContain("https://realist.ca/api/email/unsubscribe?uid=sample-user-id&token=");
    }
  });

  it("keeps the admin dashboard CTA in team-facing alerts", () => {
    for (const type of ["hot_lead_immediate_followup", "warm_lead_24h_followup", "financing_interest_followup", "sla_breach_nag", "lost_reason_nurture"] as const) {
      const { html } = buildEmailForTrigger(type, getSampleTriggerPayload(type));
      expect(html).toContain("https://realist.ca/admin/deal-desk");
    }
  });
});

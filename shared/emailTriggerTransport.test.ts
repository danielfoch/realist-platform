import { describe, expect, it } from "vitest";
import {
  emailTriggerDedupeKey,
  emailTriggerScheduledFor,
  isEmailTriggerTemplateKey,
  resolveEmailTriggerTransport,
  TEAM_AUDIENCE_TRIGGER_TYPES,
} from "./emailTriggerTransport";
import {
  buildEmailForTrigger,
  EMAIL_TRIGGER_TYPES,
  getSampleTriggerPayload,
} from "./emailTriggerTemplates";
import { EMAIL_TRIGGER_TYPES } from "./emailTriggerTemplates";

describe("resolveEmailTriggerTransport", () => {
  it("defaults to the new queue transport when unset", () => {
    expect(resolveEmailTriggerTransport(undefined)).toBe("queue");
    expect(resolveEmailTriggerTransport(null)).toBe("queue");
    expect(resolveEmailTriggerTransport("")).toBe("queue");
  });

  it("selects legacy only on the explicit rollback value", () => {
    expect(resolveEmailTriggerTransport("legacy")).toBe("legacy");
    expect(resolveEmailTriggerTransport("LEGACY")).toBe("legacy");
    expect(resolveEmailTriggerTransport("  legacy  ")).toBe("legacy");
  });

  it("treats anything else (including typos) as queue", () => {
    expect(resolveEmailTriggerTransport("queue")).toBe("queue");
    expect(resolveEmailTriggerTransport("legcy")).toBe("queue");
    expect(resolveEmailTriggerTransport("email_triggers")).toBe("queue");
  });
});

describe("isEmailTriggerTemplateKey", () => {
  it("recognizes every migrated trigger type", () => {
    for (const type of EMAIL_TRIGGER_TYPES) {
      expect(isEmailTriggerTemplateKey(type)).toBe(true);
    }
  });

  it("leaves the pre-existing email_resend producers alone", () => {
    // monthlyWinnerEmail.ts / podcastDigest.ts insert email_resend rows AND
    // send via Resend themselves — the drain must not treat their rows as
    // trigger emails or they would double-send.
    expect(isEmailTriggerTemplateKey("monthly_leaderboard_winner")).toBe(false);
    expect(isEmailTriggerTemplateKey("podcast_digest")).toBe(false);
  });

  it("ignores ghl_webhook template keys", () => {
    expect(isEmailTriggerTemplateKey("saved_search_match")).toBe(false); // ghl kind, singular
    expect(isEmailTriggerTemplateKey("co_analysis_alert")).toBe(false);
    expect(isEmailTriggerTemplateKey("milestone_reached")).toBe(false);
  });
});

describe("emailTriggerDedupeKey", () => {
  // notification_queue.dedupe_key is unique FOREVER (rows are never deleted),
  // while the legacy uq_email_triggers_pending_user_type index only deduped
  // PENDING rows. The key must therefore change across generations so a new
  // email of the same type is possible after the previous one sends.
  it("embeds trigger type and user", () => {
    const key = emailTriggerDedupeKey("sla_breach_nag", "user-1", new Date(1735689600000));
    expect(key).toBe("email_trigger:sla_breach_nag:user-1:1735689600000");
  });

  it("collides for same-instant duplicates (race-collapse, like the old partial index)", () => {
    const at = new Date();
    expect(emailTriggerDedupeKey("financing_interest", "u1", at))
      .toBe(emailTriggerDedupeKey("financing_interest", "u1", at));
  });

  it("differs across time, so a consumed key never blocks a later re-send", () => {
    const first = emailTriggerDedupeKey("financing_interest", "u1", new Date(1000));
    const later = emailTriggerDedupeKey("financing_interest", "u1", new Date(2000));
    expect(first).not.toBe(later);
  });

  it("differs across users and types", () => {
    const at = new Date(5000);
    expect(emailTriggerDedupeKey("financing_interest", "u1", at))
      .not.toBe(emailTriggerDedupeKey("financing_interest", "u2", at));
    expect(emailTriggerDedupeKey("financing_interest", "u1", at))
      .not.toBe(emailTriggerDedupeKey("saved_deal_no_submit", "u1", at));
  });
});

describe("emailTriggerScheduledFor", () => {
  const now = new Date("2026-07-05T12:00:00.000Z");

  it("schedules the 24h-delayed types a day out", () => {
    for (const type of ["warm_lead_24h_followup", "warm_lead_user_nudge"]) {
      expect(emailTriggerScheduledFor(type, now).getTime())
        .toBe(now.getTime() + 24 * 60 * 60 * 1000);
    }
  });

  it("schedules everything else immediately", () => {
    for (const type of EMAIL_TRIGGER_TYPES) {
      if (type === "warm_lead_24h_followup" || type === "warm_lead_user_nudge") continue;
      expect(emailTriggerScheduledFor(type, now).getTime()).toBe(now.getTime());
    }
  });
});

describe("TEAM_AUDIENCE_TRIGGER_TYPES", () => {
  it("matches the builders' own audience field for every trigger type", () => {
    for (const type of EMAIL_TRIGGER_TYPES) {
      const built = buildEmailForTrigger(type, getSampleTriggerPayload(type) as Record<string, any>);
      expect(
        TEAM_AUDIENCE_TRIGGER_TYPES.has(type),
        `${type}: static set says ${TEAM_AUDIENCE_TRIGGER_TYPES.has(type)}, builder says ${built.audience}`,
      ).toBe(built.audience === "team");
    }
  });
});

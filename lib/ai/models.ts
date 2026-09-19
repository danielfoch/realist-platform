/**
 * Which model each paid feature uses — one place, overridable per feature
 * without a deploy of new code:
 *
 *   AI_MODEL_MEMO / AI_MODEL_ASK / AI_MODEL_REPORT   one feature
 *   AI_MODEL                                          all of them
 *
 * Defaults are chosen by what the job needs, not by habit. The deal memo is a
 * re-narration of a memo the rules engine already wrote (and every figure in it
 * is checked against the payload), so it runs on the small model — it is also
 * the call made most often. Ask Realist chooses tools and reasons about a deal,
 * and the multiplex report weighs zoning and takeout paths: those stay on the
 * larger one.
 */
export type AiFeature = "memo" | "ask" | "report";

const DEFAULTS: Record<AiFeature, string> = {
  memo: "claude-haiku-4-5-20251001",
  ask: "claude-sonnet-5",
  report: "claude-sonnet-5",
};

export function modelFor(feature: AiFeature): string {
  return process.env[`AI_MODEL_${feature.toUpperCase()}`]?.trim() || process.env.AI_MODEL?.trim() || DEFAULTS[feature];
}

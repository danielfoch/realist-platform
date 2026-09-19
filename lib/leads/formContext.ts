/**
 * Keys only the server may put on a lead. A form can say anything; these are
 * printed for the team as things WE know ("their read", "what they buy"), tag
 * the contact, and size the opportunity — so a form never gets to set them.
 */
export const SERVER_ONLY_CONTEXT = ["brief", "numbers", "buyBox", "calls", "markets", "dealsAnalyzed"] as const;

/** What the form sent, minus anything it isn't allowed to assert. Its numbers survive, labelled as a claim. */
export function formContext(context: Record<string, unknown> | undefined): Record<string, unknown> {
  const { numbers, ...rest } = context ?? {};
  for (const key of SERVER_ONLY_CONTEXT) delete rest[key];
  return numbers && typeof numbers === "object" ? { ...rest, claimedNumbers: numbers } : rest;
}

/**
 * Consent wording shown to people, versioned. Changing the text means bumping
 * the version — the stored version is the proof of what someone agreed to.
 * Kept free of imports so forms can use it without pulling in server code.
 */
export const KEYPR_CONSENT_VERSION = "realist-keypr-cashback-v1";
export const KEYPR_CONSENT_TEXT =
  "I agree that Realist.ca may share my name, email and phone number with Keypr, its cashback partner, so they can contact me about this request.";

const TEST_EMAIL_PATTERNS = [
  /@example\.(com|org|net)$/i,
  /(^|[+._-])test([+._-]|@)/i,
  /(^|[+._-])qa([+._-]|@)/i,
  /(^|[+._-])demo([+._-]|@)/i,
];

export function isInternalTestEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return TEST_EMAIL_PATTERNS.some((pattern) => pattern.test(normalized));
}

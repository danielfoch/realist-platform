export function getLoginRedirectMessage(params: URLSearchParams): string | null {
  const error = params.get("error");
  const reason = params.get("reason");

  if (error === "link_invalid") {
    return `That sign-in link is invalid or has expired. Enter your email below and choose "Email me a sign-in link" to get a fresh one.`;
  }

  if (error === "google_not_configured") {
    return "Google sign-in is temporarily unavailable. Use your password or request an email sign-in link instead.";
  }

  if (error === "auth_failed") {
    if (reason === "state_mismatch") {
      return "Google sign-in could not be completed because the login session expired. Please try again from this page.";
    }
    if (reason === "no_email") {
      return "Google did not return an email address for this account. Try another Google account or use an email sign-in link.";
    }
    return "Google sign-in could not be completed. Please try again, or use an email sign-in link instead.";
  }

  return null;
}

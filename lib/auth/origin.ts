/**
 * CSRF guard for cookie-authenticated, state-changing routes. The session
 * cookie is SameSite=Lax, which already blocks cross-site POSTs in modern
 * browsers; this makes the rule explicit and independent of browser defaults.
 *
 * A request passes when its Origin (or, failing that, Referer) host equals the
 * host it was sent to. Requests with neither header are non-browser clients
 * and carry no ambient cookie authority worth protecting.
 */
export function isSameOrigin(request: Request): boolean {
  const source = request.headers.get("origin") ?? request.headers.get("referer");
  if (!source) return true;
  try {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    return new URL(source).host === host;
  } catch {
    return false;
  }
}

export function crossOriginResponse(): Response {
  return Response.json({ ok: false, error: "Cross-origin request refused." }, { status: 403 });
}

/**
 * Only ever redirect to a path on this site. URL parsers silently drop tabs
 * and newlines, so "/\t/evil.example" would otherwise resolve off-site: control
 * characters are refused, and the result is resolved to prove it stays put.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/account"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return fallback;
  try {
    if (new URL(next, "https://realist.invalid").origin !== "https://realist.invalid") return fallback;
  } catch {
    return fallback;
  }
  return next;
}

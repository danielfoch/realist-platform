const AUTH_PATHS = new Set(["/login", "/create-account", "/signup", "/verify-phone", "/forgot-password", "/reset-password"]);

// Cross-app SSO: realist.ca and stats.realist.ca share one account (the session
// cookie is scoped to `.realist.ca`). We allow returning a visitor to the stats
// subdomain after auth so signing up there lands them back where they were.
const EXTERNAL_RETURN_ALLOWLIST = ["https://stats.realist.ca"];

export function isAllowedExternalReturn(url: string): boolean {
  return EXTERNAL_RETURN_ALLOWLIST.some((origin) => url === origin || url.startsWith(origin + "/"));
}

export function sanitizeReturnUrl(value: string | null | undefined, fallback = "/"): string {
  if (!value) return fallback;

  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    decoded = value;
  }

  if (isAllowedExternalReturn(decoded)) return decoded;

  if (!decoded.startsWith("/") || decoded.startsWith("//")) return fallback;

  const path = decoded.split("?")[0].split("#")[0] || "/";
  if (AUTH_PATHS.has(path)) return fallback;

  return decoded;
}

/**
 * Navigate to a post-auth return URL. External (allow-listed) targets need a
 * full-page load since the SPA router can't cross origins; internal paths use
 * client-side navigation.
 */
export function goToReturnUrl(returnUrl: string, setLocation: (to: string) => void): void {
  if (isAllowedExternalReturn(returnUrl)) {
    window.location.href = returnUrl;
  } else {
    setLocation(returnUrl);
  }
}

export function getCurrentReturnUrl(fallback = "/"): string {
  return sanitizeReturnUrl(`${window.location.pathname}${window.location.search}${window.location.hash}`, fallback);
}

export function getAuthReturnUrl(fallback = "/"): string {
  const params = new URLSearchParams(window.location.search);
  return sanitizeReturnUrl(params.get("returnUrl") || sessionStorage.getItem("authReturnUrl"), fallback);
}

export function authPath(path: "/login" | "/create-account" | "/verify-phone", returnUrl = getCurrentReturnUrl()): string {
  const safeReturnUrl = sanitizeReturnUrl(returnUrl);
  return `${path}?returnUrl=${encodeURIComponent(safeReturnUrl)}`;
}

export function rememberAuthReturnUrl(returnUrl = getCurrentReturnUrl()): string {
  const safeReturnUrl = sanitizeReturnUrl(returnUrl);
  sessionStorage.setItem("authReturnUrl", safeReturnUrl);
  return safeReturnUrl;
}

export function clearAuthReturnUrl() {
  sessionStorage.removeItem("authReturnUrl");
}

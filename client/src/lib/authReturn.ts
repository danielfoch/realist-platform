const AUTH_PATHS = new Set(["/login", "/create-account", "/signup", "/verify-phone", "/forgot-password", "/reset-password"]);

export function sanitizeReturnUrl(value: string | null | undefined, fallback = "/"): string {
  if (!value) return fallback;

  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    decoded = value;
  }

  if (!decoded.startsWith("/") || decoded.startsWith("//")) return fallback;

  const path = decoded.split("?")[0].split("#")[0] || "/";
  if (AUTH_PATHS.has(path)) return fallback;

  return decoded;
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

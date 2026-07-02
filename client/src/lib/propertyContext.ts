/**
 * Shared property context: the property is the persistent object, tools are
 * lenses on it. Every analysis tool reads this on mount (after URL params)
 * and writes back what the user entered, so switching tools never means
 * re-typing the same address.
 */

export interface PropertyContext {
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  price?: number;
  monthlyRent?: number;
  mlsNumber?: string;
  lotFrontageM?: number;
  lotDepthM?: number;
  zoneCode?: string;
  updatedAt: number;
}

const STORAGE_KEY = "realist_property_context";
// Stale context is worse than none — don't prefill last month's address.
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

export function loadPropertyContext(): PropertyContext | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PropertyContext;
    if (!parsed?.updatedAt || Date.now() - parsed.updatedAt > MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePropertyContext(patch: Partial<Omit<PropertyContext, "updatedAt">>): void {
  try {
    const current = loadPropertyContext();
    const meaningful = Object.values(patch).some((v) => v !== undefined && v !== "" && v !== 0);
    if (!meaningful) return;
    const next: PropertyContext = { ...current, ...patch, updatedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable (private mode) — context is best-effort only
  }
}

/** Serialize the context (or an ad-hoc subset) into cross-tool link params. */
export function propertyContextToParams(ctx: Partial<PropertyContext>): string {
  const params = new URLSearchParams();
  if (ctx.address) params.set("address", ctx.address);
  if (ctx.city) params.set("city", ctx.city);
  if (ctx.province) params.set("province", ctx.province);
  if (ctx.price) params.set("price", String(ctx.price));
  if (ctx.monthlyRent) params.set("rent", String(ctx.monthlyRent));
  if (ctx.mlsNumber) params.set("mls", ctx.mlsNumber);
  if (ctx.lotFrontageM) params.set("frontage", String(ctx.lotFrontageM));
  if (ctx.lotDepthM) params.set("depth", String(ctx.lotDepthM));
  if (ctx.zoneCode) params.set("zone", ctx.zoneCode);
  const s = params.toString();
  return s ? `?${s}` : "";
}

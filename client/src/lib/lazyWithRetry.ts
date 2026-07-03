import { lazy, type ComponentType, type LazyExoticComponent } from "react";

/**
 * Session flag guarding against reload loops. Lives in sessionStorage so it
 * is scoped to the tab and cleared when the tab closes.
 */
const RELOAD_FLAG = "realist:chunk-reload";

function hasReloaded(): boolean {
  try {
    return sessionStorage.getItem(RELOAD_FLAG) === "1";
  } catch {
    // sessionStorage unavailable (private mode / storage disabled): pretend
    // we already reloaded so we never risk an unguarded reload loop.
    return true;
  }
}

function setReloaded(value: boolean): void {
  try {
    if (value) sessionStorage.setItem(RELOAD_FLAG, "1");
    else sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    // Ignore: worst case we skip the auto-reload and surface the error.
  }
}

/**
 * Drop-in replacement for React.lazy() that recovers from stale-chunk 404s.
 *
 * After a deploy, the set of hashed chunk files changes. A user with an old
 * tab open still holds the previous manifest, so navigating to a lazy route
 * can request a chunk that no longer exists and the dynamic import rejects.
 * The standard mitigation is a one-time full reload, which fetches the new
 * HTML + manifest. A sessionStorage flag ensures we only force-reload once:
 * if the import fails again immediately after a reload (a genuine outage,
 * not a stale deploy), the error is rethrown to the nearest error boundary.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      const module = await factory();
      setReloaded(false); // healthy again; re-arm for the next deploy
      return module;
    } catch (error) {
      if (!hasReloaded()) {
        setReloaded(true);
        window.location.reload();
        // Never settles: the reload replaces this document, so we just keep
        // React suspended (spinner) instead of flashing an error.
        return new Promise<never>(() => {});
      }
      throw error;
    }
  });
}

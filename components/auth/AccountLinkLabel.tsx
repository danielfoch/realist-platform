import type { Viewer } from "./useViewer";

/** Where the header's account link points, for a viewer that may still be loading. */
export function accountLink(viewer: Viewer | null | undefined): { href: string; label: string } {
  return viewer ? { href: "/account", label: "Account" } : { href: "/login", label: "Log in" };
}

/**
 * The link text for a header. It reads "Log in" until the viewer is known and
 * swaps to "Account" for members; the wider word always holds the space, so
 * the swap never moves the header.
 */
export function AccountLinkLabel({ viewer }: { viewer: Viewer | null | undefined }) {
  return (
    <span className="inline-grid">
      <span aria-hidden="true" className="invisible col-start-1 row-start-1">
        Account
      </span>
      <span className="col-start-1 row-start-1 text-right">{accountLink(viewer).label}</span>
    </span>
  );
}

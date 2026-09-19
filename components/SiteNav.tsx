"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AccountLinkLabel, accountLink } from "@/components/auth/AccountLinkLabel";
import { useViewer } from "@/components/auth/useViewer";

/**
 * Five doors, one per thing an investor comes here to do. Everything else on
 * the site lives behind one of them — add a page to a door, not a sixth door.
 */
const DOORS: Array<{ href: string; label: string; match: string[]; children: Array<{ href: string; label: string; note: string }> }> = [
  {
    href: "/listings",
    label: "Find deals",
    match: ["/listings", "/deals"],
    children: [
      { href: "/listings", label: "Listings", note: "Every listing in Canada, already underwritten" },
      { href: "/deals", label: "Motivated sellers", note: "Power of sale, VTB, estate — scored daily" },
      { href: "/deals/map", label: "Deal map", note: "Rents and deals on one map" },
    ],
  },
  {
    href: "/underwrite",
    label: "Underwrite",
    match: ["/underwrite", "/multiplex"],
    children: [
      { href: "/underwrite", label: "Any rental property", note: "Cash flow, returns and the price that works" },
      { href: "/multiplex", label: "Toronto multiplex", note: "Zoning, massing and the CMHC proforma" },
    ],
  },
  {
    href: "/team",
    label: "Power team",
    match: ["/team", "/work-with-us"],
    children: [
      { href: "/team", label: "Get introduced", note: "The nine people around a deal" },
      { href: "/work-with-us", label: "Buy with cash back", note: "Our team, one showing, money back at closing" },
    ],
  },
  {
    href: "/community",
    label: "Community",
    match: ["/community", "/u"],
    children: [
      { href: "/community", label: "Meetups", note: "In person, across Canada, every month" },
      { href: "/community/leaderboard", label: "Leaderboard", note: "Who's underwriting the most deals" },
    ],
  },
  {
    href: "/podcast",
    label: "Learn",
    match: ["/podcast", "/research", "/encyclopedia", "/about"],
    children: [
      { href: "/podcast", label: "Podcast", note: "Canada's #1 real estate show, twice a week" },
      { href: "/research", label: "Research", note: "Reports and market data" },
      { href: "/encyclopedia", label: "Encyclopedia", note: "149 plain-English investing guides" },
    ],
  },
];

/** Same mark as the homepage journey header (components/scrollcraft). */
export function BrandMark() {
  return (
    <span className="flex items-center gap-2.5 text-ink">
      <svg width="24" height="27" viewBox="0 0 27 30" fill="none" aria-hidden="true">
        <path d="M1 29V12l7-4v21H1Zm9 0V4l7-4v29h-7Zm9 0V16l7-4v17h-7Z" fill="currentColor" />
      </svg>
      <span className="text-[19px] font-semibold tracking-tight">
        realist<span className="text-accent">.</span>
      </span>
    </span>
  );
}

function ArrowUpRight() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 18 18 6M6 6h12v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const viewer = useViewer();
  const account = accountLink(viewer);
  // Members go straight to the tool; everyone else is one click from an account.
  const cta = viewer ? { href: "/underwrite", label: "Underwrite a deal" } : { href: "/login?next=/listings", label: "Join free" };

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  // The homepage journey carries its own header and chapter navigation.
  if (pathname === "/") return null;

  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-paper/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 md:h-20">
        <Link href="/" aria-label="Realist home" onClick={() => setOpen(false)}>
          <BrandMark />
        </Link>

        <nav className="hidden items-center gap-6 lg:flex" aria-label="Primary">
          {DOORS.map((door) => {
            const active = door.match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
            return (
              <div key={door.href} className="group relative">
                <Link
                  href={door.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative block py-2 text-[13px] font-medium transition-colors ${
                    active ? "text-ink" : "text-ink-faint hover:text-ink group-focus-within:text-ink"
                  }`}
                >
                  {door.label}
                  {active && <span className="absolute inset-x-0 -bottom-0.5 h-0.5 bg-accent" />}
                </Link>
                <div className="invisible absolute left-1/2 top-full z-50 w-72 -translate-x-1/2 pt-3 opacity-0 transition-opacity duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                  <ul className="rounded-lg border border-hairline bg-surface p-1.5 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.25)]">
                    {door.children.map((child) => (
                      <li key={child.href}>
                        <Link href={child.href} className="block rounded-[3px] px-3 py-2.5 transition-colors hover:bg-raised focus-visible:bg-raised">
                          <span className="block text-[13px] font-semibold text-ink">{child.label}</span>
                          <span className="mt-0.5 block text-[11px] leading-snug text-ink-faint">{child.note}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </nav>

        <div className="flex items-center gap-4">
          <Link
            href={account.href}
            onClick={() => setOpen(false)}
            className="hidden text-[12px] font-medium text-ink transition-colors hover:text-brand sm:inline-flex"
          >
            <AccountLinkLabel viewer={viewer} />
          </Link>
          <Link
            href={cta.href}
            className="hidden items-center gap-2 rounded-[3px] bg-brand px-4 py-2.5 text-[12px] font-semibold text-white transition-colors hover:bg-brand-deep sm:inline-flex"
          >
            {cta.label}
            <ArrowUpRight />
          </Link>
          <button
            type="button"
            className="rounded p-2 text-ink hover:bg-raised lg:hidden"
            aria-expanded={open}
            aria-controls="site-mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              {open ? (
                <>
                  <line x1="5" y1="5" x2="19" y2="19" />
                  <line x1="19" y1="5" x2="5" y2="19" />
                </>
              ) : (
                <>
                  <line x1="4" y1="9" x2="20" y2="9" />
                  <line x1="4" y1="15" x2="20" y2="15" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav id="site-mobile-menu" className="border-t border-hairline bg-paper px-4 py-3 sm:px-6 lg:hidden" aria-label="Mobile">
          {DOORS.map((door) => (
            <div key={door.href} className="border-b border-hairline py-3">
              <Link href={door.href} onClick={() => setOpen(false)} className="flex items-center justify-between text-[15px] font-semibold text-ink">
                {door.label}
                <ArrowUpRight />
              </Link>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                {door.children.map((child) => (
                  <Link key={child.href} href={child.href} onClick={() => setOpen(false)} className="py-1 text-[13px] text-ink-soft hover:text-brand">
                    {child.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
          <Link
            href={account.href}
            onClick={() => setOpen(false)}
            className="flex items-center justify-between py-3.5 text-[15px] font-medium text-ink"
          >
            {account.label}
            <ArrowUpRight />
          </Link>
          <Link
            href={cta.href}
            onClick={() => setOpen(false)}
            className="mt-3 flex items-center justify-between rounded-[3px] bg-brand px-4 py-3 text-[14px] font-semibold text-white"
          >
            {cta.label}
            <ArrowUpRight />
          </Link>
        </nav>
      )}
    </header>
  );
}

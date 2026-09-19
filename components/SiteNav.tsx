"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AccountLinkLabel, accountLink } from "@/components/auth/AccountLinkLabel";
import { useViewer } from "@/components/auth/useViewer";

const NAV_ITEMS = [
  { href: "/listings", label: "Listings" },
  { href: "/multiplex", label: "Multiplex" },
  { href: "/deals", label: "Deals" },
  { href: "/podcast", label: "Podcast" },
  { href: "/research", label: "Research" },
  { href: "/community", label: "Community" },
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

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative py-2 text-[13px] font-medium transition-colors ${
                  active ? "text-ink" : "text-ink-faint hover:text-ink"
                }`}
              >
                {item.label}
                {active && <span className="absolute inset-x-0 -bottom-0.5 h-0.5 bg-accent" />}
              </Link>
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
            href="/multiplex"
            className="hidden items-center gap-2 rounded-[3px] bg-brand px-4 py-2.5 text-[12px] font-semibold text-white transition-colors hover:bg-brand-deep sm:inline-flex"
          >
            Start building
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
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between border-b border-hairline py-3.5 text-[15px] font-medium text-ink last:border-b-0"
            >
              {item.label}
              <ArrowUpRight />
            </Link>
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
            href="/multiplex"
            onClick={() => setOpen(false)}
            className="mt-3 flex items-center justify-between rounded-[3px] bg-brand px-4 py-3 text-[14px] font-semibold text-white"
          >
            Start building
            <ArrowUpRight />
          </Link>
        </nav>
      )}
    </header>
  );
}

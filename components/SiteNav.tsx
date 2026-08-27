"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/listings", label: "Listings" },
  { href: "/multiplex", label: "Multiplex" },
  { href: "/deals", label: "Deals" },
  { href: "/podcast", label: "Podcast" },
  { href: "/research", label: "Research" },
  { href: "/community", label: "Community" },
];

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <Image src="/logo.png" alt="Realist" width={30} height={30} className="rounded" />
          <span className="font-display text-xl font-semibold tracking-tight">Realist</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-brand-wash text-brand-deep"
                    : "text-ink-soft hover:bg-brand-wash/60 hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <Link
            href="/work-with-us"
            className="ml-3 rounded-md bg-brand px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-deep"
          >
            Work with us
          </Link>
        </nav>

        <button
          type="button"
          className="md:hidden rounded-md p-2 text-ink-soft hover:bg-brand-wash"
          aria-expanded={open}
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? (
              <>
                <line x1="5" y1="5" x2="19" y2="19" />
                <line x1="19" y1="5" x2="5" y2="19" />
              </>
            ) : (
              <>
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </>
            )}
          </svg>
        </button>
      </div>

      {open && (
        <nav className="border-t border-hairline bg-surface px-4 py-3 md:hidden" aria-label="Mobile">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2.5 text-base font-medium text-ink-soft hover:bg-brand-wash hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/work-with-us"
            onClick={() => setOpen(false)}
            className="mt-2 block rounded-md bg-brand px-3 py-2.5 text-center text-base font-semibold text-white"
          >
            Work with us
          </Link>
        </nav>
      )}
    </header>
  );
}

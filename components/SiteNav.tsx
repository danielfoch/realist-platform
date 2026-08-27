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
    <header className="sticky top-0 z-50 border-b border-hairline bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-13 max-w-[1600px] items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          {/* Mark is black-on-transparent; invert onto the dark ground. */}
          <Image src="/logo.png" alt="" width={22} height={22} className="invert" />
          <span className="text-[15px] font-bold tracking-tight">
            realist<span className="text-brand">.ca</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 md:flex" aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                  active
                    ? "bg-raised text-ink"
                    : "text-ink-soft hover:bg-surface hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <Link
            href="/work-with-us"
            className="ml-3 rounded bg-brand px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-deep"
          >
            Work with us
          </Link>
        </nav>

        <button
          type="button"
          className="md:hidden rounded p-2 text-ink-soft hover:bg-surface"
          aria-expanded={open}
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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
              className="block rounded px-3 py-2.5 text-[15px] font-medium text-ink-soft hover:bg-raised hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/work-with-us"
            onClick={() => setOpen(false)}
            className="mt-2 block rounded bg-brand px-3 py-2.5 text-center text-[15px] font-semibold text-white"
          >
            Work with us
          </Link>
        </nav>
      )}
    </header>
  );
}

"use client";

import { usePathname } from "next/navigation";

/** The homepage journey renders its own footer; suppress the shared one there. */
export function HideOnHome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return <>{children}</>;
}

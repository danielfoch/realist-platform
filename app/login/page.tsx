import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginPanel } from "@/components/auth/LoginPanel";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Realist or create an account to save listings and multiplex underwrites.",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: false },
};

/** Holds the panel's footprint while the query string is read in the browser. */
function LoginFallback() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:px-6 sm:py-16" aria-hidden="true">
      <div className="h-3 w-20 rounded-[3px] bg-raised" />
      <div className="mt-3 h-9 w-64 max-w-full rounded-[3px] bg-raised" />
      <div className="mt-7 h-[22rem] rounded-lg border border-hairline bg-surface" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex-1 bg-paper">
      <Suspense fallback={<LoginFallback />}>
        <LoginPanel />
      </Suspense>
    </div>
  );
}

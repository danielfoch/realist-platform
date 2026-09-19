import type { Metadata } from "next";
import Link from "next/link";
import { safeNextPath } from "@/lib/auth/origin";
import { eyebrowClass, primaryButtonClass } from "@/components/auth/shared";

export const metadata: Metadata = {
  title: "Confirm sign-in",
  robots: { index: false, follow: false },
  // Keeps the token out of Referer headers sent to other sites. Not
  // "no-referrer": that turns the form's Origin header into "null", which the
  // same-origin guard on the verify route (rightly) refuses.
  referrer: "same-origin",
};

/**
 * Where an emailed sign-in link lands. The link is only spent when the person
 * presses the button (a POST) — so a mail scanner that pre-fetches the URL
 * can't use it up first. A plain form: it works without JavaScript.
 */
export default async function ConfirmSignInPage(props: PageProps<"/login/confirm">) {
  const query = await props.searchParams;
  const token = typeof query.token === "string" ? query.token : "";
  const next = safeNextPath(typeof query.next === "string" ? query.next : null);

  return (
    <div className="flex-1 bg-paper">
      <div className="mx-auto w-full max-w-md px-4 py-12 sm:px-6 sm:py-16">
        <p className={`${eyebrowClass} text-brand`}>Sign in</p>
        <h1 className="font-display mt-2 text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl">
          One more <em>tap</em>.
        </h1>
        <div className="mt-7 rounded-lg border border-hairline bg-surface p-6">
          {token ? (
            <form method="post" action="/api/auth/magic/verify">
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="next" value={next} />
              <p className="text-sm leading-relaxed text-ink-soft">
                Your link checks out. Press the button to finish signing in on this device.
              </p>
              <button type="submit" className={`${primaryButtonClass} mt-5 w-full`}>
                Sign in to Realist
              </button>
            </form>
          ) : (
            <p className="text-sm leading-relaxed text-ink-soft">
              This link is missing its code. <Link href="/login" className="font-medium text-brand hover:text-brand-deep">Ask for a new one</Link>.
            </p>
          )}
          <p className="mt-5 border-t border-hairline pt-4 text-xs leading-relaxed text-ink-faint">
            Links work once and expire after 20 minutes. Didn&apos;t ask for this? Close the page — nothing happens.
          </p>
        </div>
      </div>
    </div>
  );
}

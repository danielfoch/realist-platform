import type { Metadata } from "next";
import Link from "next/link";
import { eyebrowClass, primaryButtonClass } from "@/components/auth/shared";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
  referrer: "same-origin",
};

/** One button, no sign-in. The link is only acted on by this POST — never by opening the page. */
export default async function UnsubscribePage(props: PageProps<"/unsubscribe">) {
  const query = await props.searchParams;
  const value = (key: string) => (typeof query[key] === "string" ? (query[key] as string) : "");
  const done = value("done") === "1";
  const failed = value("error") === "1";
  const action = `/api/email/unsubscribe?u=${encodeURIComponent(value("u"))}&t=${encodeURIComponent(value("t"))}`;

  return (
    <div className="flex-1 bg-paper">
      <div className="mx-auto w-full max-w-md px-4 py-12 sm:px-6 sm:py-16">
        <p className={`${eyebrowClass} text-brand`}>Email</p>
        <h1 className="font-display mt-2 text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl">
          {done ? (
            <>
              You&rsquo;re <em>unsubscribed</em>.
            </>
          ) : (
            <>
              Stop the <em>emails</em>?
            </>
          )}
        </h1>
        <div className="mt-7 rounded-lg border border-hairline bg-surface p-6">
          {done ? (
            <p className="text-sm leading-relaxed text-ink-soft">
              No more updates or weekly notes from Realist. Your account, analyses and saved deals are untouched, and
              sign-in links still work. Changed your mind?{" "}
              <Link href="/account" className="font-medium text-brand hover:text-brand-deep">
                Turn them back on in your account
              </Link>
              .
            </p>
          ) : (
            <form method="post" action={action}>
              <p className="text-sm leading-relaxed text-ink-soft">
                {failed
                  ? "That link didn't check out — it may be incomplete. You can also switch emails off in your account."
                  : "One press and the weekly note and Realist updates stop. Your account and your analyses stay exactly as they are."}
              </p>
              {!failed && (
                <button type="submit" className={`${primaryButtonClass} mt-5 w-full`}>
                  Unsubscribe
                </button>
              )}
              {failed && (
                <Link href="/account" className="mt-4 inline-block text-sm font-semibold text-brand hover:text-brand-deep">
                  Go to your account →
                </Link>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

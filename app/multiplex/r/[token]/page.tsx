import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { multiplexUnderwritings } from "@/lib/db/schema";
import { DISCLAIMER } from "@/lib/multiplex/underwriter";
import {
  UnderwriteReport,
  type UnderwritePayload,
} from "@/components/multiplex/UnderwriteReport";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/multiplex/r/[token]">): Promise<Metadata> {
  const { token } = await params;
  const row = await loadByToken(token);
  return {
    title: row ? `Multiplex screen — ${row.address}` : "Shared multiplex report",
    robots: { index: false },
  };
}

async function loadByToken(token: string) {
  if (!/^[a-f0-9]{24}$/.test(token)) return null;
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(multiplexUnderwritings)
      .where(eq(multiplexUnderwritings.shareToken, token))
      .limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export default async function SharedReportPage({
  params,
}: PageProps<"/multiplex/r/[token]">) {
  const { token } = await params;
  const row = await loadByToken(token);
  if (!row || !row.resultJson) notFound();

  const payload: UnderwritePayload = {
    status: "complete",
    id: row.id,
    // Deliberately omit shareToken so the shared view doesn't re-offer sharing.
    site: row.siteJson as UnderwritePayload["site"],
    underwrite: row.resultJson as UnderwritePayload["underwrite"],
    disclaimer: DISCLAIMER,
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-brand">
        Shared multiplex screen
      </p>
      <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight">
        {row.address}
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        Run on {row.createdAt.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })} with{" "}
        <Link href="/multiplex" className="text-brand hover:underline">
          the Realist Multiplex Underwriter
        </Link>
        . Run your own site free.
      </p>
      <div className="mt-8">
        <UnderwriteReport payload={payload} />
      </div>
    </div>
  );
}

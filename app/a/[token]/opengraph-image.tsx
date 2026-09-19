import { eq } from "drizzle-orm";
import { publicName } from "@/lib/analyses/dealKey";
import { getSharedAnalysis } from "@/lib/analyses/store";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { OG_CONTENT_TYPE, OG_SIZE, shareCard } from "@/lib/og/card";
import { clampInputs, underwrite } from "@/lib/underwriting/underwriter";

export const alt = "A shared underwrite on Realist";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const money = (value: number) => `$${Math.round(Math.abs(value)).toLocaleString("en-CA")}`;

/** The same numbers the page shows — recomputed here, never trusted from a URL. */
export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const analysis = await getSharedAnalysis(token).catch(() => null);
  const inputs = analysis ? clampInputs(analysis.inputs) : null;
  if (!analysis || !inputs) return shareCard({ eyebrow: "A shared underwrite", title: "Run the numbers on any deal." });

  let who = "An investor";
  if (analysis.userId) {
    const [row] = await getDb().select({ name: users.name }).from(users).where(eq(users.id, analysis.userId)).limit(1).catch(() => []);
    who = row?.name ? publicName(row.name) : "A Realist member";
  }
  const result = underwrite(inputs);
  const cashFlow = result.monthlyCashFlow;
  return shareCard({
    eyebrow: `${who}'s underwrite`,
    title: analysis.address?.trim() || (analysis.mlsNumber ? `MLS® ${analysis.mlsNumber}` : "A deal"),
    subtitle: `${money(inputs.price)} · ${money(inputs.monthlyRent)}/mo rent · ${inputs.downPaymentPercent}% down at ${inputs.interestRate}%`,
    stats: [
      { label: "Cash flow / mo", value: cashFlow == null ? "—" : `${cashFlow < 0 ? "−" : "+"}${money(cashFlow)}`, tone: cashFlow != null && cashFlow < 0 ? "bad" : undefined },
      { label: "Cap rate", value: result.capRate == null ? "—" : `${result.capRate.toFixed(1)}%` },
      { label: "Debt coverage", value: result.dscr == null ? "—" : result.dscr.toFixed(2) },
    ],
    footer: "Disagree with a number? Run it with yours — realist.ca",
  });
}

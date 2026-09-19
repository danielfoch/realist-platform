import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { eyebrowClass, formatDay, primaryButtonClass, secondaryButtonClass } from "@/components/auth/shared";
import { fmtMoney } from "@/components/multiplex/format";
import { publicName } from "@/lib/analyses/dealKey";
import { reopenHref } from "@/lib/analyses/history";
import { getSharedAnalysis } from "@/lib/analyses/store";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { templateMemo } from "@/lib/underwriting/dealMemo";
import { clampInputs, readTheDeal, underwrite } from "@/lib/underwriting/underwriter";

export const dynamic = "force-dynamic";

// Someone chose to send this to a specific person; it isn't for search engines.
export const metadata: Metadata = { title: "A shared underwrite", robots: { index: false, follow: false } };

async function sharerName(userId: string | null): Promise<string> {
  if (!userId) return "An investor";
  try {
    const [row] = await getDb().select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
    return row?.name ? publicName(row.name) : "A Realist member";
  } catch {
    return "A Realist member";
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-hairline last:border-0">
      <th scope="row" className="py-2 pr-3 text-left text-sm font-normal text-ink-soft">
        {label}
      </th>
      <td className="tnum py-2 text-right text-sm font-semibold text-ink">{value}</td>
    </tr>
  );
}

export default async function SharedAnalysisPage(props: PageProps<"/a/[token]">) {
  const { token } = await props.params;
  const analysis = await getSharedAnalysis(token).catch(() => null);
  const inputs = analysis ? clampInputs(analysis.inputs) : null;
  if (!analysis || !inputs) notFound();

  const result = underwrite(inputs);
  const read = readTheDeal(result);
  const memo = templateMemo(
    { address: analysis.address, city: analysis.city, province: analysis.province, propertyType: analysis.propertyType, rentSourceLabel: analysis.rentSource, rentEdited: analysis.edited.includes("monthlyRent") },
    inputs,
  );
  const who = await sharerName(analysis.userId);
  const title = analysis.address?.trim() || (analysis.mlsNumber ? `MLS® ${analysis.mlsNumber}` : "A deal");
  const runYourOwn = reopenHref(analysis) ?? "/underwrite";
  const cashFlow = result.monthlyCashFlow;

  return (
    <>
      <section className="border-b border-hairline bg-surface">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
          <p className={`${eyebrowClass} text-brand`}>
            {who}&rsquo;s underwrite · {formatDay(analysis.updatedAt)}
          </p>
          <h1 className="font-display mt-2 break-words text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            These are {who === "An investor" ? "their" : `${who.split(" ")[0]}'s`} numbers and assumptions, not a listing&rsquo;s. Disagree with one?{" "}
            <Link href={runYourOwn} className="font-medium text-brand hover:text-brand-deep">
              Run it with yours →
            </Link>
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-4xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.1fr_1fr]">
        <div>
          <div className="rounded-lg border border-hairline bg-surface p-5">
            <p className={`${eyebrowClass} text-ink-faint`}>Cash flow after the mortgage</p>
            <p className={`tnum font-display mt-1 text-4xl font-semibold tracking-tight ${cashFlow != null && cashFlow < 0 ? "text-bad" : "text-ink"}`}>
              {cashFlow == null ? "—" : `${cashFlow < 0 ? "−" : "+"}${fmtMoney(Math.abs(cashFlow))}`}
              <span className="ml-1 text-base font-medium text-ink-faint">/mo</span>
            </p>
            <p className="mt-3 text-sm font-medium leading-snug text-ink">{read.headline}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">{read.detail}</p>
          </div>

          <div className="mt-6 space-y-5">
            <p className="text-sm leading-relaxed text-ink">{memo.summary}</p>
            {[
              ["What's working", memo.working],
              ["What to watch", memo.watch],
            ].map(([heading, items]) => (
              <div key={heading as string}>
                <h2 className={`${eyebrowClass} text-ink-faint`}>{heading as string}</h2>
                <ul className="mt-1.5 space-y-1.5">
                  {(items as string[]).map((item) => (
                    <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-ink-soft">
                      <span className="mt-[0.5rem] h-1.5 w-1.5 shrink-0 rounded-full bg-ink" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div>
              <h2 className={`${eyebrowClass} text-ink-faint`}>The offer</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{memo.offer.line}</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-hairline bg-surface p-5">
            <h2 className="font-display text-lg font-semibold tracking-tight">The numbers</h2>
            <table className="mt-2 w-full">
              <tbody>
                <Row label="Price" value={fmtMoney(inputs.price)} />
                <Row label="Rent / month" value={fmtMoney(inputs.monthlyRent)} />
                <Row label="Units" value={String(inputs.units)} />
                <Row label="Down payment" value={`${inputs.downPaymentPercent}%`} />
                <Row label="Rate · amortization" value={`${inputs.interestRate}% · ${inputs.amortizationYears} yrs`} />
                <Row label="Vacancy · mgmt · maintenance" value={`${inputs.vacancyPercent}% · ${inputs.managementPercent}% · ${inputs.maintenancePercent}%`} />
                <Row label="Tax · insurance / yr" value={`${fmtMoney(inputs.annualPropertyTax)} · ${fmtMoney(inputs.annualInsurance)}`} />
              </tbody>
            </table>
          </div>
          <div className="rounded-lg border border-hairline bg-surface p-5">
            <h2 className="font-display text-lg font-semibold tracking-tight">The returns</h2>
            <table className="mt-2 w-full">
              <tbody>
                <Row label="Cap rate" value={result.capRate == null ? "—" : `${result.capRate.toFixed(1)}%`} />
                <Row label="Cash-on-cash" value={result.cashOnCashReturn == null ? "—" : `${result.cashOnCashReturn.toFixed(1)}%`} />
                <Row label="Debt coverage" value={result.dscr == null ? "—" : result.dscr.toFixed(2)} />
                <Row label={`IRR · ${inputs.holdPeriodYears} yrs`} value={result.irr == null ? "—" : `${result.irr.toFixed(1)}%`} />
                <Row label="Cash needed to close" value={fmtMoney(result.cashInvested)} />
              </tbody>
            </table>
          </div>
          <div className="band-night rounded-lg p-5">
            <p className="text-sm font-semibold text-ink">Every listing in Canada, already underwritten.</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">Change any number. See the price that makes a deal work. Free.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={runYourOwn} className={primaryButtonClass}>
                Run this deal yourself
              </Link>
              <Link href="/listings" className={secondaryButtonClass}>
                Browse listings
              </Link>
            </div>
          </div>
        </div>
      </div>
      <p className="mx-auto max-w-4xl px-4 pb-10 text-[11px] leading-relaxed text-ink-faint sm:px-6">
        Estimates for comparing deals, not advice. Mortgage payments use Canadian semi-annual compounding.
      </p>
    </>
  );
}

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { RetryDeliveriesButton } from "@/components/admin/RetryDeliveriesButton";
import { eyebrowClass, formatDay } from "@/components/auth/shared";
import { isAdmin } from "@/lib/auth/admin";
import { getCurrentUser } from "@/lib/auth/current";
import { emailConfigured } from "@/lib/email";
import { getOutboxHealth, getRecentLeads, type LeadWithDeliveries, type OutboxHealthRow } from "@/lib/leads/admin";
import { KIND_LABELS } from "@/lib/leads/crmPayload";
import { ghlConfigured } from "@/lib/leads/ghl";
import { teamRecipients } from "@/lib/leads/routing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leads — operator view",
  robots: { index: false, follow: false },
};

const DESTINATION_LABELS: Record<string, string> = { ghl: "GoHighLevel", team_email: "Team email", keypr: "Keypr handoff" };

function Configured({ label, ok, hint }: { label: string; ok: boolean; hint: string }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ok ? "bg-ink" : "bg-accent"}`} aria-hidden="true" />
      <span>
        <span className="font-semibold text-ink">{label}</span>{" "}
        <span className="text-ink-soft">{ok ? "connected" : `not connected — ${hint}`}</span>
      </span>
    </li>
  );
}

function HealthTable({ rows }: { rows: OutboxHealthRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-ink-soft">Nothing has been captured yet.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-hairline text-left">
          {["Destination", "Status", "Count", "Oldest waiting"].map((heading) => (
            <th key={heading} scope="col" className={`${eyebrowClass} py-2 pr-4 font-medium text-ink-faint`}>
              {heading}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.destination}-${row.status}`} className="border-b border-hairline last:border-0">
            <td className="py-2 pr-4 text-ink">{DESTINATION_LABELS[row.destination] ?? row.destination}</td>
            <td className={`py-2 pr-4 ${row.status === "failed" ? "font-semibold text-bad" : "text-ink-soft"}`}>{row.status}</td>
            <td className="tnum py-2 pr-4 text-ink">{row.count}</td>
            <td className="tnum py-2 text-ink-soft">
              {row.oldestPendingMinutes == null
                ? "—"
                : row.oldestPendingMinutes < 120
                  ? `${row.oldestPendingMinutes} min`
                  : `${Math.round(row.oldestPendingMinutes / 60)} h`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LeadRow({ lead, deliveries }: LeadWithDeliveries) {
  const property = lead.property?.address ?? (lead.property?.mlsNumber ? `MLS® ${lead.property.mlsNumber}` : null);
  return (
    <li className="py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-semibold text-ink">
          {KIND_LABELS[lead.kind] ?? lead.kind}
          <span className="font-normal text-ink-soft"> · {lead.name ?? "No name"}</span>
        </p>
        <p className="tnum text-xs text-ink-faint">{formatDay(lead.createdAt)}</p>
      </div>
      <p className="mt-0.5 break-all text-sm text-ink-soft">
        <a href={`mailto:${lead.email}`} className="text-brand hover:text-brand-deep">
          {lead.email}
        </a>
        {lead.phone ? ` · ${lead.phone}` : ""}
        {lead.city || lead.province ? ` · ${[lead.city, lead.province].filter(Boolean).join(", ")}` : ""}
      </p>
      {(property || lead.message) && (
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          {property && <span className="text-ink">{property}</span>}
          {property && lead.message ? " — " : ""}
          {lead.message}
        </p>
      )}
      <p className="tnum mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] uppercase tracking-[1px] text-ink-faint">
        <span>{lead.intent}</span>
        <span>{lead.routing.replace(/_/g, " ")}</span>
        {deliveries.map((delivery) => (
          <span key={delivery.id} className={delivery.status === "failed" ? "font-semibold text-bad" : delivery.status === "sent" ? "text-ink" : ""} title={delivery.lastError ?? undefined}>
            {DESTINATION_LABELS[delivery.destination] ?? delivery.destination}: {delivery.status}
            {delivery.status === "failed" && delivery.lastError ? ` (${delivery.lastError.slice(0, 80)})` : ""}
          </span>
        ))}
      </p>
    </li>
  );
}

export default async function AdminLeadsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/leads");
  // A 404, not a 403: people who aren't operators don't need to know this exists.
  if (!isAdmin(user)) notFound();

  let health: OutboxHealthRow[] = [];
  let recent: LeadWithDeliveries[] = [];
  let unavailable = false;
  try {
    [health, recent] = await Promise.all([getOutboxHealth(), getRecentLeads(100)]);
  } catch (error) {
    console.error("[admin/leads]", (error as Error).message);
    unavailable = true;
  }
  const failed = health.filter((row) => row.status === "failed").reduce((sum, row) => sum + row.count, 0);

  return (
    <>
      <section className="border-b border-hairline bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <p className={`${eyebrowClass} text-brand`}>Operator view</p>
          <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight">
            Leads and where they <em>went</em>.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
            Every hand-raise is saved here first, then delivered to the CRM, the team inbox and (for consented Ontario
            offers) Keypr. Anything not yet connected waits — nothing is dropped.
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_1.6fr]">
        <div className="space-y-8">
          <section aria-labelledby="admin-connections" className="rounded-lg border border-hairline bg-surface p-5">
            <h2 id="admin-connections" className="font-display text-lg font-semibold tracking-tight">
              Connections
            </h2>
            <ul className="mt-3 space-y-2">
              <Configured label="GoHighLevel" ok={ghlConfigured()} hint="set GHL_API_KEY + GHL_LOCATION_ID, or GHL_WEBHOOK_URL" />
              <Configured label="Email sending" ok={emailConfigured()} hint="set RESEND_API_KEY" />
              <Configured label="Acquisition inbox" ok={teamRecipients("acquisition").to.length > 0} hint="set ACQUISITION_LEAD_EMAILS" />
              <Configured label="Financing inbox" ok={Boolean(process.env.FINANCING_LEAD_EMAILS?.trim())} hint="set FINANCING_LEAD_EMAILS" />
              <Configured label="Keypr handoff" ok={Boolean(process.env.KEYPR_REALIST_SECRET?.trim())} hint="set KEYPR_REALIST_SECRET" />
            </ul>
          </section>

          <section aria-labelledby="admin-outbox" className="rounded-lg border border-hairline bg-surface p-5">
            <h2 id="admin-outbox" className="font-display text-lg font-semibold tracking-tight">
              Outbox
            </h2>
            <div className="mt-3">{unavailable ? <p className="text-sm text-bad">The database couldn&rsquo;t be reached.</p> : <HealthTable rows={health} />}</div>
            <div className="mt-4">
              <RetryDeliveriesButton />
              {failed > 0 && <p className="mt-2 text-xs text-bad">{failed} delivery attempts have given up. Fix the cause, then retry.</p>}
            </div>
          </section>
        </div>

        <section aria-labelledby="admin-recent">
          <h2 id="admin-recent" className="font-display text-lg font-semibold tracking-tight">
            Latest {recent.length || ""} leads
          </h2>
          {recent.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">No leads yet. They&rsquo;ll appear here the moment a form is sent.</p>
          ) : (
            <ul className="mt-2 divide-y divide-hairline">
              {recent.map((entry) => (
                <LeadRow key={entry.lead.id} {...entry} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

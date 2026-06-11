/**
 * Import sponsor outreach targets into the native CRM.
 *
 * CSV columns (header row required):
 *   company,industry,whyFit,sponsorsCompetitor,website,contactPath,tier,confidence
 *
 * Creates one crm_contacts row per company (contactType=sponsor, stage=new,
 * owner = the admin email passed as OWNER_EMAIL or danielfoch@gmail.com),
 * with the research stored in sourceDetail + data so the next-step engine
 * can drive outreach. Idempotent on (owner, name).
 *
 * Run: OWNER_EMAIL=danielfoch@gmail.com npx tsx scripts/import-sponsor-targets.ts path/to/sponsor-targets.csv
 */

import fs from "fs";
import { and, eq } from "drizzle-orm";
import { db } from "../server/db";
import { crmActivities, crmContacts, users } from "../shared/schema";

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath || !fs.existsSync(csvPath)) {
    console.error("Usage: npx tsx scripts/import-sponsor-targets.ts <sponsor-targets.csv>");
    process.exit(1);
  }
  const ownerEmail = (process.env.OWNER_EMAIL || "danielfoch@gmail.com").toLowerCase();
  const [owner] = await db.select().from(users).where(eq(users.email, ownerEmail)).limit(1);
  if (!owner) {
    console.error(`Owner user not found: ${ownerEmail}`);
    process.exit(1);
  }

  const lines = fs.readFileSync(csvPath, "utf8").split(/\r?\n/).filter((line) => line.trim());
  const header = parseCsvLine(lines[0]).map((cell) => cell.toLowerCase());
  const col = (name: string) => header.indexOf(name.toLowerCase());
  const required = ["company"];
  for (const name of required) {
    if (col(name) === -1) {
      console.error(`CSV missing required column: ${name}`);
      process.exit(1);
    }
  }

  let created = 0;
  let skipped = 0;
  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const company = cells[col("company")];
    if (!company) continue;

    const [existing] = await db.select({ id: crmContacts.id }).from(crmContacts)
      .where(and(eq(crmContacts.ownerUserId, owner.id), eq(crmContacts.name, company)))
      .limit(1);
    if (existing) { skipped += 1; continue; }

    const get = (name: string) => (col(name) >= 0 ? cells[col(name)] || null : null);
    const sponsorsCompetitor = get("sponsorscompetitor");
    const [contact] = await db.insert(crmContacts).values({
      ownerUserId: owner.id,
      name: company,
      contactType: "sponsor",
      stage: "new",
      source: "sponsor_research",
      sourceDetail: [get("industry"), sponsorsCompetitor ? `sponsors: ${sponsorsCompetitor}` : null]
        .filter(Boolean).join(" · "),
      tags: [
        "outreach:sponsor-2026",
        sponsorsCompetitor ? "poach:competitor-sponsor" : "fit:category",
        get("confidence") ? `confidence:${get("confidence")}` : null,
      ].filter(Boolean),
      data: {
        industry: get("industry"),
        whyFit: get("whyfit"),
        sponsorsCompetitor,
        website: get("website"),
        contactPath: get("contactpath"),
        suggestedTier: get("tier"),
        confidence: get("confidence"),
      },
      consentEmail: false, // cold B2B outreach — CASL conspicuous-publication rules apply, handled by the outreach SOP
    }).returning();

    await db.insert(crmActivities).values({
      contactId: contact.id,
      userId: owner.id,
      kind: "system",
      body: `Imported from sponsor research.${get("whyfit") ? ` Why fit: ${get("whyfit")}` : ""}${get("contactpath") ? ` Contact path: ${get("contactpath")}` : ""}`,
    });
    created += 1;
  }

  console.log(`done — ${created} sponsor targets imported, ${skipped} already existed.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

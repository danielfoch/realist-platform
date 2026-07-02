/**
 * Import a Meetup.com Pro member export into the native CRM — the data half
 * of the meetup.com → realist.ca migration.
 *
 * Meetup Pro exports a CSV per group (Group tools → Manage members → Export).
 * Column names vary slightly between exports, so this matches loosely:
 * name ("Name"), email ("Email" / "Email address" — only present on Pro
 * exports with member emails enabled), city ("Location"/"City"), joined
 * ("Join date"/"Joined Group on"), lastAttended ("Last Attended").
 *
 * Each member becomes a crm_contacts row (contactType=investor,
 * source=meetup_import, stage=new) plus a crm_activities note. Idempotent on
 * (owner, email). Members WITHOUT an email are skipped and counted.
 *
 * CASL NOTE: importing creates CRM records only — it does NOT grant email
 * consent and nothing is sent. Meetup members likely qualify for *implied*
 * consent (existing non-business relationship from attending events, 2-year
 * window), which permits a migration announcement, but that's Dan's call:
 * pass --implied-consent to write consentEmail=true with the source recorded
 * as meetup_import_implied so the ledger shows exactly what was claimed.
 *
 * Run:
 *   OWNER_EMAIL=danielfoch@gmail.com npx tsx scripts/import-meetup-members.ts members.csv
 *   ... members.csv --implied-consent   # also mark implied email consent
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
  const impliedConsent = process.argv.includes("--implied-consent");
  if (!csvPath || !fs.existsSync(csvPath)) {
    console.error("Usage: npx tsx scripts/import-meetup-members.ts <meetup-members.csv> [--implied-consent]");
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
  const findCol = (...names: string[]) => {
    for (const name of names) {
      const exact = header.indexOf(name.toLowerCase());
      if (exact !== -1) return exact;
    }
    for (const name of names) {
      const fuzzy = header.findIndex((h) => h.includes(name.toLowerCase()));
      if (fuzzy !== -1) return fuzzy;
    }
    return -1;
  };

  const nameCol = findCol("name", "member name");
  const emailCol = findCol("email address", "email");
  const cityCol = findCol("location", "city");
  const joinedCol = findCol("joined group on", "join date", "joined");
  const lastAttendedCol = findCol("last attended");

  if (emailCol === -1) {
    console.error(
      "CSV has no email column. Meetup Pro exports include emails only when member emails are enabled for the group — re-export with emails.",
    );
    process.exit(1);
  }

  let created = 0;
  let skippedExisting = 0;
  let skippedNoEmail = 0;

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const email = (cells[emailCol] || "").toLowerCase();
    if (!email || !email.includes("@")) {
      skippedNoEmail++;
      continue;
    }
    const name = (nameCol !== -1 && cells[nameCol]) || email.split("@")[0];
    const city = (cityCol !== -1 && cells[cityCol]) || null;
    const joined = (joinedCol !== -1 && cells[joinedCol]) || null;
    const lastAttended = (lastAttendedCol !== -1 && cells[lastAttendedCol]) || null;

    const [existing] = await db
      .select({ id: crmContacts.id })
      .from(crmContacts)
      .where(and(eq(crmContacts.ownerUserId, owner.id), eq(crmContacts.email, email)))
      .limit(1);
    if (existing) {
      skippedExisting++;
      continue;
    }

    const [contact] = await db
      .insert(crmContacts)
      .values({
        ownerUserId: owner.id,
        name,
        email,
        contactType: "investor",
        stage: "new",
        source: "meetup_import",
        sourceDetail: [city, joined ? `joined ${joined}` : null, lastAttended ? `last attended ${lastAttended}` : null]
          .filter(Boolean)
          .join(" · ") || "Meetup.com member export",
        targetMarket: city,
        consentEmail: impliedConsent,
        data: {
          meetupImport: { city, joined, lastAttended, importedAt: new Date().toISOString(), impliedConsent },
        },
      })
      .returning();

    await db.insert(crmActivities).values({
      contactId: contact.id,
      userId: owner.id,
      kind: "system",
      body: `Imported from Meetup.com member export${impliedConsent ? " (implied consent claimed — attended Realist meetups)" : " (no email consent recorded)"}. Next: migration announcement inviting them to RSVP on realist.ca/meetups.`,
      metadata: { source: "meetup_import" },
    });
    created++;
  }

  console.log(
    `Done. created=${created}, skipped existing=${skippedExisting}, skipped no-email=${skippedNoEmail}, implied consent=${impliedConsent ? "YES (recorded on contacts)" : "no"}`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});

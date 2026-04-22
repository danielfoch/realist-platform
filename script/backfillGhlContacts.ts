import { db } from "../server/db";
import { users } from "@shared/models/auth";
import { asc } from "drizzle-orm";

const WEBHOOK_URL = process.env.GHL_WEBHOOK_URL;
const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT_ARG = process.argv.find(a => a.startsWith("--limit="));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split("=")[1], 10) : undefined;
const DELAY_MS = 250;

async function postToGHL(user: typeof users.$inferSelect): Promise<number | "dry-run" | "error"> {
  if (!WEBHOOK_URL) throw new Error("GHL_WEBHOOK_URL is not set");

  const payload = {
    email: user.email,
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    phone: user.phone || "",
    formTag: "realist_backfill",
    tags: [
      "realist-user",
      "backfill",
      `signup-${user.createdAt ? new Date(user.createdAt).toISOString().slice(0, 7) : "unknown"}`,
    ],
    source: "realist.ca",
    signupTimestamp: user.createdAt ? new Date(user.createdAt).toISOString() : new Date().toISOString(),
  };

  if (DRY_RUN) return "dry-run";

  try {
    const resp = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return resp.status;
  } catch {
    return "error";
  }
}

async function main() {
  if (!WEBHOOK_URL && !DRY_RUN) {
    console.error("[ghl-backfill] GHL_WEBHOOK_URL is not set. Aborting. Use --dry-run to preview.");
    process.exit(1);
  }

  console.log(
    `[ghl-backfill] Starting${DRY_RUN ? " (DRY RUN — no webhook calls)" : ""}${LIMIT ? ` (limit=${LIMIT})` : ""}`
  );

  const rows = await db.select().from(users).orderBy(asc(users.createdAt));
  const targets = LIMIT ? rows.slice(0, LIMIT) : rows;
  console.log(`[ghl-backfill] Found ${rows.length} users; processing ${targets.length}`);

  let ok = 0;
  let failed = 0;
  const failures: Array<{ email: string; status: number | string }> = [];

  for (let i = 0; i < targets.length; i++) {
    const u = targets[i];
    const status = await postToGHL(u);
    const success = status === "dry-run" || (typeof status === "number" && status >= 200 && status < 300);

    if (success) {
      ok++;
    } else {
      failed++;
      failures.push({ email: u.email, status });
    }

    if ((i + 1) % 25 === 0 || i === targets.length - 1) {
      console.log(`[ghl-backfill] ${i + 1}/${targets.length} processed (ok=${ok}, failed=${failed})`);
    }

    if (!DRY_RUN && i < targets.length - 1) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`[ghl-backfill] Done. ok=${ok}, failed=${failed}`);
  if (failures.length) {
    console.log("[ghl-backfill] Failures:");
    for (const f of failures) console.log(`  - ${f.email}: ${f.status}`);
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error("[ghl-backfill] Fatal:", err);
  process.exit(1);
});

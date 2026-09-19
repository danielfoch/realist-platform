/**
 * npm run setup:crawl              — give the nightly listings crawl what it needs, and start the first run
 * npm run setup:crawl -- --dry-run — check everything, change nothing
 *
 * The crawl (scripts/sync-ddf.ts) is too long for a serverless function, so it
 * runs on GitHub Actions ("Lean nightly data sync", scheduled from the default
 * branch). It needs three repository secrets. This sets them:
 *
 *   CREA_DDF_USERNAME / CREA_DDF_PASSWORD — you paste the pair (the password is hidden); it is
 *     tested against CREA first, and the feed's size is checked so an office-only feed is caught;
 *   DATABASE_URL — read from the Vercel project (the unpooled URL), never shown.
 *
 * Every value goes to `gh secret set` over stdin: never a command-line argument,
 * never printed, and the file Vercel's CLI writes is deleted before anything else happens.
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NATIONAL_POOL_FLOOR, checkDdfCredentials } from "../lib/preflight/keys";
import { ask } from "../lib/preflight/prompt";

const DRY = process.argv.includes("--dry-run");
const REPO = "danielfoch/realist-platform";
const WORKFLOW = "lean-data-sync.yml";

function run(command: string, args: string[]): { ok: boolean; out: string } {
  const result = spawnSync(command, args, { encoding: "utf8" });
  return { ok: result.status === 0, out: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

/** The production database URL, straight from Vercel into memory. The pulled file lives for milliseconds in a private temp dir. */
function databaseUrl(): string | null {
  const dir = mkdtempSync(path.join(tmpdir(), "realist-crawl-"));
  const file = path.join(dir, "env");
  try {
    if (!run("npx", ["vercel", "env", "pull", file, "--environment=production", "--yes"]).ok) return null;
    const lines = readFileSync(file, "utf8").split("\n");
    const read = (name: string) => lines.find((line) => line.startsWith(`${name}=`))?.slice(name.length + 1).trim().replace(/^"|"$/g, "") || null;
    // The crawl holds a connection for an hour or more: use the direct URL, not the pooler.
    return read("DATABASE_URL_UNPOOLED") ?? read("DATABASE_URL");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function setSecret(name: string, value: string): Promise<boolean> {
  if (DRY) {
    console.log(`  (dry run) would set ${name}`);
    return true;
  }
  const ok = await new Promise<boolean>((resolve) => {
    const child = spawn("gh", ["secret", "set", name, "--repo", REPO], { stdio: ["pipe", "ignore", "pipe"] });
    let errors = "";
    child.stderr.on("data", (chunk) => (errors += String(chunk)));
    child.on("close", (code) => {
      if (code !== 0) console.log(`  ✗ GitHub refused ${name}: ${errors.trim().split("\n").pop() ?? `exit ${code}`}`);
      resolve(code === 0);
    });
    child.stdin.end(value);
  });
  if (ok) console.log(`  ✓ set ${name}`);
  return ok;
}

async function main() {
  console.log(`\nRealist — the nightly listings crawl${DRY ? "  (dry run: nothing is changed)" : ""}\n`);
  if (!run("gh", ["auth", "status"]).ok) {
    console.error("GitHub's CLI isn't signed in. Run `gh auth login`, then this again.");
    process.exit(1);
  }

  const url = databaseUrl();
  if (!url) {
    console.error("Couldn't read DATABASE_URL from the Vercel project. Run this from the repo, signed in (`npx vercel login`).");
    process.exit(1);
  }
  console.log("  ✓ production database URL read from Vercel (not shown)\n");

  console.log("  The CREA DDF pair — the National Shared Pool feed (the one the Replit app uses).");
  let pair: { username: string; password: string } | null = null;
  for (let attempt = 0; attempt < 3 && !pair; attempt += 1) {
    const username = await ask("  DDF username (client id): ");
    if (!username) break;
    const password = await ask("  DDF password (client secret): ", true);
    if (!password) break;
    const result = await checkDdfCredentials(username, password);
    console.log(`  ${!result.ok ? "✗" : result.listings !== undefined && result.listings < NATIONAL_POOL_FLOOR ? "!" : "✓"} ${result.detail}`);
    if (!result.ok) continue;
    if (result.listings !== undefined && result.listings < NATIONAL_POOL_FLOOR && !/^y/i.test(await ask("  Use this feed anyway? [y/N] "))) continue;
    pair = { username, password };
  }
  if (!pair) return console.log("\nNothing was changed.\n");

  console.log("");
  const done = [await setSecret("DATABASE_URL", url), await setSecret("CREA_DDF_USERNAME", pair.username), await setSecret("CREA_DDF_PASSWORD", pair.password)];
  if (done.includes(false) || DRY) return console.log(DRY ? "\nDry run complete.\n" : "\nSome secrets weren't set — see above.\n");

  // GitHub can only start a workflow it finds on the default branch.
  if (!run("gh", ["workflow", "view", WORKFLOW, "--repo", REPO]).ok) {
    return console.log(`\nSecrets are set. The workflow isn't on the default branch yet — merge the "Lean nightly data sync" pull request, then:\n\n  gh workflow run ${WORKFLOW} --repo ${REPO}\n`);
  }
  if (!/^n/i.test(await ask("\nStart the first crawl now? It takes an hour or more, on GitHub. [Y/n] "))) {
    const started = run("gh", ["workflow", "run", WORKFLOW, "--repo", REPO]);
    console.log(started.ok ? `\nStarted. Watch it:  gh run watch --repo ${REPO}\nIt then runs every night at 06:20 UTC.\n` : `\nCouldn't start it: ${started.out.trim().split("\n").pop()}\n`);
  }
}

main().catch((error) => {
  console.error("setup crashed:", (error as Error).message);
  process.exit(2);
});

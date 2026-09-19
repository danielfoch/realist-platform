/**
 * npm run setup:keys              — add what's missing to Vercel (Production), one guided prompt at a time
 * npm run setup:keys -- --redo    — ask again for keys that are already set
 * npm run setup:keys -- --dry-run — test what you paste, save nothing
 *
 * YOU type the keys, in your own terminal. Each one is tested against the real
 * service before it is saved (a GHL contact lookup, Resend's verified-domain
 * list, a CREA token, Anthropic's model list), then handed to `vercel env add`
 * over stdin — never a command-line argument, never a file, never printed.
 * Press Enter at any prompt to skip it.
 */
import { spawn, spawnSync } from "node:child_process";
import { checkAnthropic, checkGhl, checkResend, type CheckResult } from "../lib/preflight/checks";
import { KEY_GROUPS, NATIONAL_POOL_FLOOR, checkDdfCredentials, parseEnvNames, shapeWarning, type KeySpec } from "../lib/preflight/keys";
import { ask } from "../lib/preflight/prompt";

const DRY = process.argv.includes("--dry-run");
const REDO = process.argv.includes("--redo");
const saved: string[] = [];

async function save(spec: Pick<KeySpec, "name" | "secret">, value: string): Promise<boolean> {
  if (DRY) {
    console.log(`    (dry run) would save ${spec.name}`);
    saved.push(spec.name);
    return true;
  }
  const ok = await new Promise<boolean>((resolve) => {
    const child = spawn("npx", ["vercel", "env", "add", spec.name, "production", spec.secret ? "--sensitive" : "--no-sensitive", "--force", "--yes"], { stdio: ["pipe", "ignore", "pipe"] });
    let errors = "";
    child.stderr.on("data", (chunk) => (errors += String(chunk)));
    child.on("close", (code) => {
      if (code !== 0) console.log(`    ✗ Vercel refused ${spec.name}: ${errors.trim().split("\n").pop() ?? `exit ${code}`}`);
      resolve(code === 0);
    });
    child.stdin.end(`${value}\n`);
  });
  if (ok) {
    console.log(`    ✓ saved ${spec.name}`);
    saved.push(spec.name);
  }
  return ok;
}

const show = (result: CheckResult) =>
  console.log(`    ${result.status === "ok" ? "✓" : result.status === "warn" ? "!" : "✗"} ${result.detail}${result.fix && result.status !== "ok" ? `\n      → ${result.fix}` : ""}`);

/**
 * A check that couldn't be REACHED says nothing about the key. Don't strand the person over a
 * network blip: say so, and let them decide — the live site proves the key either way.
 */
async function unreachable(result: CheckResult): Promise<boolean | null> {
  if (!/^Couldn't reach/.test(result.detail)) return null;
  return /^y/i.test(await ask("    That's a connection problem, not a verdict on the key. Save it anyway? [y/N] "));
}

/** Test the group's values against the real service. True = worth saving. */
async function proves(title: string, values: Record<string, string>): Promise<boolean> {
  if (title === "GoHighLevel") {
    const [result] = await checkGhl(values);
    show(result);
    return (await unreachable(result)) ?? result.status === "ok";
  }
  if (title === "Email (Resend)") {
    const result = await checkResend(values);
    show(result);
    // An unverified domain is worth fixing, but the key itself is good: save it. Only a rejected key is not.
    return (await unreachable(result)) ?? !/rejected the key/.test(result.detail);
  }
  if (title === "AI (Anthropic)") {
    const result = await checkAnthropic(values);
    show(result);
    return (await unreachable(result)) ?? result.status === "ok";
  }
  if (title.startsWith("Live MLS")) {
    const result = await checkDdfCredentials(values.CREA_DDF_USERNAME ?? "", values.CREA_DDF_PASSWORD ?? "");
    const officeFeed = result.ok && result.listings !== undefined && result.listings < NATIONAL_POOL_FLOOR;
    console.log(`    ${!result.ok ? "✗" : officeFeed ? "!" : "✓"} ${result.detail}`);
    // An office's own feed authenticates fine and leaves the site empty: saving it has to be a decision, not a default.
    return result.ok && (!officeFeed || /^y/i.test(await ask("    Save this feed anyway? [y/N] ")));
  }
  return true;
}

async function choosePipeline(token: string, locationId: string) {
  try {
    const response = await fetch(`https://services.leadconnectorhq.com/opportunities/pipelines?locationId=${encodeURIComponent(locationId)}`, {
      headers: { Authorization: `Bearer ${token}`, Version: "2021-07-28", Accept: "application/json" },
    });
    const body = (await response.json().catch(() => ({}))) as { pipelines?: Array<{ id: string; name: string; stages?: Array<{ id: string; name: string }> }> };
    const pipelines = body.pipelines ?? [];
    if (!response.ok || pipelines.length === 0) return console.log("    (No pipelines visible to this token — skipped. Add the opportunities scopes to use one.)");
    console.log("\n  Open an opportunity for every showing, offer and financing request? Pick the pipeline:");
    pipelines.forEach((pipeline, index) => console.log(`    ${index + 1}. ${pipeline.name}`));
    const pipeline = pipelines[Number(await ask("  Number (Enter to skip): ")) - 1];
    if (!pipeline) return;
    await save({ name: "GHL_PIPELINE_ID", secret: false }, pipeline.id);
    const stages = pipeline.stages ?? [];
    stages.forEach((stage, index) => console.log(`    ${index + 1}. ${stage.name}`));
    const stage = stages[Number(await ask("  New requests land in stage number (Enter = the pipeline's first): ")) - 1];
    if (stage) await save({ name: "GHL_PIPELINE_STAGE_ID", secret: false }, stage.id);
  } catch (error) {
    console.log(`    (Couldn't list pipelines: ${(error as Error).message})`);
  }
}

async function main() {
  const listing = spawnSync("npx", ["vercel", "env", "ls", "production"], { encoding: "utf8" });
  if (listing.status !== 0) {
    console.error("Couldn't read the Vercel project. Run this from the repo, signed in (`npx vercel login`).");
    process.exit(1);
  }
  const existing = parseEnvNames(`${listing.stdout}\n${listing.stderr}`);

  console.log(`\nRealist — connect the keys${DRY ? "  (dry run: nothing is saved)" : ""}\n\nYou paste each one; it's tested, then saved to Vercel → Production. Enter skips.\n`);
  for (const group of KEY_GROUPS) {
    const wanted = group.keys.filter((key) => REDO || !existing.has(key.name));
    if (wanted.length === 0) {
      console.log(`✓ ${group.title} — already set\n`);
      continue;
    }
    console.log(`${group.title}${group.keys.every((key) => key.optional) ? " (optional)" : ""}\n  ${group.why}`);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const values: Record<string, string> = {};
      for (const key of wanted) {
        console.log(`  · ${key.where}`);
        const value = await ask(`  ${key.ask}: `, key.secret);
        if (!value) break;
        const warning = shapeWarning(key, value);
        if (warning) console.log(`    ! Careful — ${warning}.`);
        values[key.name] = value;
      }
      if (Object.keys(values).length < wanted.length) {
        console.log("  skipped\n");
        break;
      }
      if (await proves(group.title, values)) {
        for (const key of wanted) await save(key, values[key.name]);
        if (group.title === "GoHighLevel" && (REDO || !existing.has("GHL_PIPELINE_ID"))) await choosePipeline(values.GHL_API_KEY, values.GHL_LOCATION_ID);
        console.log("");
        break;
      }
      console.log(attempt < 2 ? "  Not saved. Try again, or press Enter to skip.\n" : "  Not saved — moving on.\n");
    }
  }

  if (saved.length === 0) return console.log("Nothing new was saved.\n");
  console.log(`Saved: ${saved.join(", ")}.`);
  console.log("A running deployment doesn't see new keys until the next deploy.");
  if (DRY) return;
  if (/^y/i.test(await ask("Deploy to production now? [y/N] "))) {
    const deploy = spawnSync("npx", ["vercel", "--prod", "--yes"], { stdio: "inherit" });
    if (deploy.status === 0) console.log('\nLive. Open /admin/leads: it shows what\'s connected, and "Retry failed and deliver now" flushes every lead that was waiting.\n');
  } else console.log("When you're ready:  npx vercel --prod\n");
}

main().catch((error) => {
  console.error("setup crashed:", (error as Error).message);
  process.exit(2);
});

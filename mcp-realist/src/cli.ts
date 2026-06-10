#!/usr/bin/env node
/**
 * @realist/mcp CLI — same tools as the MCP server, but invoked from a terminal.
 *
 * Usage:
 *   realist underwrite <mls#>           [--rent N] [--strategy buyHold|brrr|...]
 *   realist analyze <address> <price>   [--rent N] [--units N] [--beds N]
 *   realist find "4-plex Hamilton under 900k"
 *   realist list                        [--limit N]
 *   realist get <analysis-id>
 *   realist submit <mls#> --analysis <id> [--title "..."] [--notes "..."]
 *   realist rates
 *   realist market <city>
 *   realist whoami
 *
 * Auth: REALIST_API_KEY env var (or ~/.realist/config.json with {"apiKey": "..."}).
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { RealistClient, RealistApiError } from "./client.js";

function loadConfig(): { apiKey?: string; baseUrl?: string } {
  try {
    const raw = readFileSync(join(homedir(), ".realist", "config.json"), "utf8");
    return JSON.parse(raw);
  } catch { return {}; }
}

const config = loadConfig();
const apiKey = process.env.REALIST_API_KEY || config.apiKey;
const baseUrl = process.env.REALIST_BASE_URL || config.baseUrl;

function die(msg: string, code = 1): never {
  console.error(msg);
  process.exit(code);
}

if (!apiKey) {
  die(`No API key found.
  Set REALIST_API_KEY environment variable, or
  create ~/.realist/config.json with {"apiKey": "realist_live_..."}
  Mint a key at https://realist.ca/account/api-keys`);
}

const client = new RealistClient({ apiKey, baseUrl });

// Argument parsing
const args = process.argv.slice(2);
const cmd = args[0];
const rest = args.slice(1);

function flag(name: string): string | undefined {
  const i = rest.findIndex((a) => a === `--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
}
function num(name: string): number | undefined {
  const v = flag(name);
  return v !== undefined ? Number(v) : undefined;
}
function positional(): string[] {
  const out: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith("--")) { i++; continue; }
    out.push(rest[i]);
  }
  return out;
}

function output(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

async function main() {
  try {
    switch (cmd) {
      case "whoami": {
        output(await client.me());
        return;
      }
      case "underwrite": {
        const [mls] = positional();
        if (!mls) die("Usage: realist underwrite <mls#>");
        output(await client.underwriteListing({
          mlsNumber: mls,
          strategyType: flag("strategy") as any,
          monthlyRent: num("rent"),
          downPaymentPercent: num("down"),
          interestRate: num("rate"),
          vacancyRate: num("vacancy"),
          expenseRatio: num("expenses"),
        }));
        return;
      }
      case "analyze": {
        const [address, priceStr] = positional();
        if (!address || !priceStr) die("Usage: realist analyze <address> <price>");
        output(await client.underwriteCustom({
          address,
          price: Number(priceStr),
          city: flag("city"),
          province: flag("province"),
          countryMode: (flag("country") as any) || "CA",
          strategyType: flag("strategy") as any,
          monthlyRent: num("rent"),
          units: num("units"),
          beds: num("beds"),
          downPaymentPercent: num("down"),
          interestRate: num("rate"),
          vacancyRate: num("vacancy"),
          expenseRatio: num("expenses"),
        }));
        return;
      }
      case "find": {
        const query = positional().join(" ");
        if (!query) die('Usage: realist find "your search query"');
        output(await client.findDeals({ query, limit: num("limit") }));
        return;
      }
      case "list": {
        output(await client.listAnalyses(num("limit") || 25));
        return;
      }
      case "get": {
        const [id] = positional();
        if (!id) die("Usage: realist get <analysis-id>");
        output(await client.getAnalysis(id));
        return;
      }
      case "submit": {
        const [mls] = positional();
        if (!mls) die("Usage: realist submit <mls#> [--analysis <id>] [--title ...] [--notes ...]");
        output(await client.submitForReview({
          mlsNumber: mls,
          analysisId: flag("analysis"),
          title: flag("title"),
          summary: flag("summary"),
          notes: flag("notes"),
          visibility: (flag("visibility") as any) || "public",
        }));
        return;
      }
      case "rates": {
        output(await client.mortgageRates());
        return;
      }
      case "market": {
        const [city] = positional();
        output(await client.marketReport(city));
        return;
      }
      case "help":
      case "--help":
      case "-h":
      case undefined:
        console.log(`realist — Realist.ca CLI (also installable as an MCP server: @realist/mcp)

Commands:
  whoami                                     Verify your API key
  underwrite <mls#> [--strategy ...]         Underwrite a Canadian MLS listing
  analyze <address> <price> [--rent N ...]   Underwrite a custom property
  find "<natural-language query>"            Search for deals
  list [--limit N]                           List your saved underwritings
  get <analysis-id>                          Fetch one underwriting
  submit <mls#> [--analysis <id>]            Post to the community feed
  rates                                       Current Canadian mortgage rates
  market [city]                              Latest market report

Auth: REALIST_API_KEY env var, or ~/.realist/config.json {"apiKey": "..."}.
Mint a key at https://realist.ca/account/api-keys`);
        return;
      default:
        die(`Unknown command: ${cmd}\nRun 'realist help' for usage.`);
    }
  } catch (err) {
    if (err instanceof RealistApiError) {
      console.error(`Realist API error (${err.status}): ${err.message}`);
      console.error(JSON.stringify(err.body, null, 2));
      process.exit(2);
    }
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

void main();

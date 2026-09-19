/**
 * Headless, timeout-bounded listing-portal playbooks.
 *
 * Playwright is optional at runtime: unit tests inject a BrowserDriver.
 * CI without browser binaries still runs the planner + mocked driver.
 * Screenshots go to os.tmpdir() only — never committed.
 *
 * Realist-only. No persistent user profiles. No login / paywall bypass.
 */
import { mkdir, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import {
  ACTION_SELECTORS,
  BROWSER_CLICK_ACTIONS,
  browserActInputSchema,
  planBrowserAct,
  urlLooksLikeLoginWall,
  type BrowserActAction,
  type BrowserActInput,
  type BrowserActPlan,
} from "@shared/browserAct";
import { ListingExtractError, extractFromHtml, looksLikeLoginWall, mergeSignals, parseJsonLd, parseOpenGraph } from "@shared/listingExtract";

export class BrowserActError extends Error {
  constructor(
    public code: "blocked_or_login_wall" | "action_not_allowed" | "browser_unavailable" | "invalid_input" | "timeout",
    message: string,
  ) {
    super(message);
    this.name = "BrowserActError";
  }
}

export interface BrowserDriver {
  goto(url: string): Promise<{ url: string; html: string }>;
  clickFirst(action: Exclude<BrowserActAction, "scroll_to_load" | "extract_after_render">): Promise<boolean>;
  scroll(times: number): Promise<void>;
  content(): Promise<string>;
  url(): Promise<string>;
  screenshot(filePath: string): Promise<string | null>;
  close(): Promise<void>;
}

export type BrowserDriverFactory = (opts: { timeoutMs: number }) => Promise<BrowserDriver>;

let driverFactory: BrowserDriverFactory | null = null;

export function setBrowserDriverFactory(factory: BrowserDriverFactory | null) {
  driverFactory = factory;
}

export interface BrowserActResult {
  finalUrl: string;
  extracted?: Record<string, unknown> | null;
  screenshotPaths: string[];
  actionsTaken: string[];
  warnings: string[];
  playbookId: string;
  dryRun?: boolean;
}

export function previewBrowserAct(input: unknown): BrowserActResult & { plan: BrowserActPlan } {
  const parsed = browserActInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new BrowserActError("invalid_input", parsed.error.issues.map((issue) => issue.message).join("; "));
  }
  const plan = planBrowserAct(parsed.data);
  if (plan.blocked) {
    throw new BrowserActError("blocked_or_login_wall", "URL looks like a login, checkout, or board WEBForms wall. Public pages only.");
  }
  if (!plan.actionsToRun.length) {
    throw new BrowserActError("action_not_allowed", "No playbook-allowed actions remain. Denied: " + plan.denied.join(", "));
  }
  return {
    dryRun: true,
    finalUrl: plan.url,
    extracted: null,
    screenshotPaths: [],
    actionsTaken: [],
    warnings: [
      ...plan.warnings,
      plan.requiresApproval
        ? "Clicks stay needs_approval until a human approves. No browser has launched."
        : "Read-only extract_after_render may run without approval.",
    ],
    playbookId: plan.playbookId,
    plan,
  };
}

function pageLooksLoginWalled(html: string, url: string): boolean {
  if (urlLooksLikeLoginWall(url)) return true;
  const preview = mergeSignals(parseJsonLd(html), parseOpenGraph(html));
  return looksLikeLoginWall(html, preview);
}

async function defaultPlaywrightFactory(opts: { timeoutMs: number }): Promise<BrowserDriver> {
  let chromium: typeof import("playwright").chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new BrowserActError("browser_unavailable", "Playwright is not installed.");
  }

  let browser: import("playwright").Browser;
  try {
    browser = await chromium.launch({
      headless: true,
      timeout: Math.min(opts.timeoutMs, 20_000),
    });
  } catch (err: any) {
    throw new BrowserActError(
      "browser_unavailable",
      err?.message || "Chromium is not available in this environment.",
    );
  }

  const context = await browser.newContext({
    userAgent: "RealistAgentBrowser/1.0 (+https://realist.ca/api/agent; public listing playbooks)",
    javaScriptEnabled: true,
    acceptDownloads: false,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(Math.min(opts.timeoutMs, 12_000));
  page.setDefaultNavigationTimeout(Math.min(opts.timeoutMs, 15_000));

  const close = async () => {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  };

  return {
    async goto(url) {
      const response = await page.goto(url, { waitUntil: "domcontentloaded" });
      const html = await page.content();
      const finalUrl = page.url();
      if (response && (response.status() === 401 || response.status() === 403)) {
        throw new BrowserActError("blocked_or_login_wall", `Listing page returned HTTP ${response.status()}.`);
      }
      return { url: finalUrl, html };
    },
    async clickFirst(action) {
      const hints = ACTION_SELECTORS[action];
      for (const css of hints.css) {
        const loc = page.locator(css).first();
        if (await loc.count().catch(() => 0)) {
          await loc.click({ timeout: 2_000 }).catch(() => null);
          return true;
        }
      }
      for (const name of hints.names) {
        const loc = page.getByRole("button", { name }).first();
        if (await loc.count().catch(() => 0)) {
          await loc.click({ timeout: 2_000 }).catch(() => null);
          return true;
        }
      }
      return false;
    },
    async scroll(times) {
      const hops = Math.min(Math.max(times, 1), 5);
      for (let i = 0; i < hops; i++) {
        await page.evaluate(() => window.scrollBy(0, Math.round(window.innerHeight * 0.9))).catch(() => {});
        await page.waitForTimeout(250);
      }
    },
    content: () => page.content(),
    url: async () => page.url(),
    async screenshot(filePath) {
      try {
        await page.screenshot({ path: filePath, fullPage: false, timeout: 3_000 });
        return filePath;
      } catch {
        return null;
      }
    },
    close,
  };
}

export async function runBrowserAct(
  input: unknown,
  ctx: { jobId?: string; takeScreenshots?: boolean } = {},
): Promise<BrowserActResult> {
  const parsed = browserActInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new BrowserActError("invalid_input", parsed.error.issues.map((issue) => issue.message).join("; "));
  }
  const plan = planBrowserAct(parsed.data);
  if (plan.blocked) {
    throw new BrowserActError("blocked_or_login_wall", "URL looks like a login, checkout, or board WEBForms wall. Public pages only.");
  }
  if (!plan.actionsToRun.length) {
    throw new BrowserActError("action_not_allowed", "No playbook-allowed actions remain.");
  }

  const factory = driverFactory ?? defaultPlaywrightFactory;
  let driver: BrowserDriver;
  try {
    driver = await factory({ timeoutMs: plan.timeoutMs });
  } catch (err: any) {
    if (err instanceof BrowserActError) throw err;
    throw new BrowserActError("browser_unavailable", err?.message || "Browser driver failed to start.");
  }

  const actionsTaken: string[] = [];
  const warnings = [...plan.warnings];
  const screenshotPaths: string[] = [];
  const deadline = Date.now() + plan.timeoutMs;
  const artifactDir = join(tmpdir(), "realist-browser-act", ctx.jobId || "adhoc");

  try {
    const landed = await driver.goto(plan.url);
    if (pageLooksLoginWalled(landed.html, landed.url)) {
      throw new BrowserActError("blocked_or_login_wall", "Rendered page requires login or a challenge. Public markup only.");
    }

    let steps = 0;
    for (const action of plan.actionsToRun) {
      if (Date.now() > deadline) throw new BrowserActError("timeout", "browser.act exceeded timeoutMs.");
      if (steps >= plan.maxSteps) {
        warnings.push("Stopped at maxSteps; remaining playbook actions were skipped.");
        break;
      }

      if (action === "scroll_to_load") {
        await driver.scroll(3);
        actionsTaken.push(action);
        steps += 1;
      } else if (action === "extract_after_render") {
        const html = await driver.content();
        const finalUrl = await driver.url();
        if (pageLooksLoginWalled(html, finalUrl)) {
          throw new BrowserActError("blocked_or_login_wall", "Rendered page requires login or a challenge. Public markup only.");
        }
        const extracted = extractFromHtml({ html, url: finalUrl });
        actionsTaken.push(action);
        steps += 1;
        if (ctx.takeScreenshots) {
          await mkdir(artifactDir, { recursive: true });
          const filePath = join(artifactDir, "final.png");
          const saved = await driver.screenshot(filePath);
          if (saved) screenshotPaths.push(saved);
        }
        return {
          finalUrl,
          extracted: extracted as unknown as Record<string, unknown>,
          screenshotPaths,
          actionsTaken,
          warnings,
          playbookId: plan.playbookId,
        };
      } else if ((BROWSER_CLICK_ACTIONS as readonly string[]).includes(action)) {
        const clicked = await driver.clickFirst(action);
        actionsTaken.push(clicked ? action : `${action}:miss`);
        if (!clicked) warnings.push(`No public ${action} control found; skipped.`);
        steps += 1;
        const nowUrl = await driver.url();
        if (urlLooksLikeLoginWall(nowUrl)) {
          throw new BrowserActError("blocked_or_login_wall", "Navigation reached a login or paywall URL.");
        }
      }
    }

    const html = await driver.content();
    const finalUrl = await driver.url();
    if (pageLooksLoginWalled(html, finalUrl)) {
      throw new BrowserActError("blocked_or_login_wall", "Rendered page requires login or a challenge. Public markup only.");
    }
    let extracted: Record<string, unknown> | null = null;
    try {
      extracted = extractFromHtml({ html, url: finalUrl }) as unknown as Record<string, unknown>;
    } catch (err: any) {
      if (err instanceof ListingExtractError && err.code === "blocked_or_login_wall") {
        throw new BrowserActError("blocked_or_login_wall", err.message);
      }
      warnings.push(err?.message || "extract_after_render failed");
    }
    if (ctx.takeScreenshots) {
      await mkdir(artifactDir, { recursive: true });
      const filePath = join(artifactDir, "final.png");
      const saved = await driver.screenshot(filePath);
      if (saved) screenshotPaths.push(saved);
      else await writeFile(join(artifactDir, "note.txt"), "screenshot skipped", "utf8").catch(() => {});
    }
    return { finalUrl, extracted, screenshotPaths, actionsTaken, warnings, playbookId: plan.playbookId };
  } finally {
    await driver.close().catch(() => {});
  }
}

export function createMemoryBrowserDriver(opts: {
  html: string;
  url?: string;
  clicks?: Partial<Record<string, boolean>>;
  loginAfterClick?: boolean;
}): BrowserDriver {
  let currentUrl = opts.url || "https://www.zillow.com/homedetails/1";
  let html = opts.html;
  return {
    async goto(url) {
      currentUrl = url;
      return { url: currentUrl, html };
    },
    async clickFirst(action) {
      const ok = opts.clicks?.[action] !== false;
      if (opts.loginAfterClick) currentUrl = "https://www.zillow.com/login";
      return ok;
    },
    async scroll() {},
    content: async () => html,
    url: async () => currentUrl,
    screenshot: async (filePath) => filePath,
    close: async () => {},
  };
}

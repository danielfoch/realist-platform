/**
 * Browser action specialist (P4) — playbook registry, not an open-ended agent.
 *
 * Public listing-portal interactions only: cookie banners, "show more",
 * gallery, bounded scroll, then the existing listing extract on rendered HTML.
 * Never login, pay, solve captcha, upload files, or send email.
 *
 * Realist-only. Homies is out of scope.
 */
import { z } from "zod";

export const BROWSER_ACT_ACTIONS = [
  "dismiss_cookie_banner",
  "expand_description",
  "open_listing_gallery",
  "scroll_to_load",
  "extract_after_render",
] as const;
export type BrowserActAction = (typeof BROWSER_ACT_ACTIONS)[number];

/** Side-effecting clicks. These always need human approval. */
export const BROWSER_CLICK_ACTIONS: readonly BrowserActAction[] = [
  "dismiss_cookie_banner",
  "expand_description",
  "open_listing_gallery",
  "scroll_to_load",
];

/**
 * Hard denylist — never registered, never executed. Zod already rejects them
 * as job input; the list is the contract tests and the playbook planner share.
 */
export const BROWSER_DENIED_ACTIONS = [
  "login",
  "signin",
  "submit_password",
  "fill_password",
  "solve_captcha",
  "captcha",
  "pay",
  "checkout",
  "upload_file",
  "send_email",
  "submit_webform",
  "board_auth",
  "mfa",
] as const;
export type BrowserDeniedAction = (typeof BROWSER_DENIED_ACTIONS)[number];

export const BROWSER_DENIED_ACTION_SET = new Set<string>(BROWSER_DENIED_ACTIONS);

const LOGIN_PATH = /\/(login|log-in|signin|sign-in|signup|sign-up|account\/login|auth\/|checkout|cart|payment|paywall|password|captcha|webforms?)\b/i;

export interface BrowserPlaybook {
  id: string;
  hosts: string[];
  actions: BrowserActAction[];
}

const ALL_SAFE: BrowserActAction[] = [...BROWSER_ACT_ACTIONS];
const EXTRACT_ONLY: BrowserActAction[] = ["extract_after_render"];

/**
 * Host → allowed actions. Known listing portals may click the public
 * playbook. Everyone else may only fetch rendered DOM for extract.
 */
export const BROWSER_PLAYBOOKS: BrowserPlaybook[] = [
  { id: "realtor-ca", hosts: ["realtor.ca"], actions: ALL_SAFE },
  { id: "realtor-com", hosts: ["realtor.com"], actions: ALL_SAFE },
  { id: "zillow", hosts: ["zillow.com"], actions: ALL_SAFE },
  { id: "redfin", hosts: ["redfin.com"], actions: ALL_SAFE },
  { id: "homes-com", hosts: ["homes.com"], actions: ALL_SAFE },
  { id: "rightmove-uk", hosts: ["rightmove.co.uk"], actions: ALL_SAFE },
  { id: "zoopla-uk", hosts: ["zoopla.co.uk"], actions: ALL_SAFE },
  { id: "domain-au", hosts: ["domain.com.au"], actions: ALL_SAFE },
  { id: "realestate-au", hosts: ["realestate.com.au"], actions: ALL_SAFE },
  { id: "immoscout-de", hosts: ["immobilienscout24.de"], actions: ALL_SAFE },
  { id: "seloger-fr", hosts: ["seloger.com"], actions: ALL_SAFE },
  { id: "idealista", hosts: ["idealista.com", "idealista.it", "idealista.pt"], actions: ALL_SAFE },
  { id: "propertyguru", hosts: ["propertyguru.com.sg", "propertyguru.com.my"], actions: ALL_SAFE },
  { id: "generic-public", hosts: ["*"], actions: EXTRACT_ONLY },
];

export const browserActInputSchema = z.object({
  url: z.string().url(),
  actions: z.array(z.enum(BROWSER_ACT_ACTIONS)).min(1).max(10).optional(),
  maxSteps: z.number().int().min(1).max(20).optional(),
  timeoutMs: z.number().int().min(1_000).max(60_000).optional(),
});
export type BrowserActInput = z.infer<typeof browserActInputSchema>;

export interface BrowserActPlan {
  url: string;
  host: string | null;
  playbookId: string;
  requested: BrowserActAction[];
  allowed: BrowserActAction[];
  denied: string[];
  actionsToRun: BrowserActAction[];
  requiresApproval: boolean;
  blocked: boolean;
  blockReason: string | null;
  warnings: string[];
  maxSteps: number;
  timeoutMs: number;
}

export function isDeniedBrowserAction(action: string): boolean {
  return BROWSER_DENIED_ACTION_SET.has(action.trim().toLowerCase());
}

export function normalizeBrowserHost(host: string): string {
  return host.replace(/^www\./i, "").toLowerCase();
}

export function hostMatchesPlaybook(host: string, pattern: string): boolean {
  if (pattern === "*") return true;
  const h = normalizeBrowserHost(host);
  const p = normalizeBrowserHost(pattern);
  return h === p || h.endsWith(`.${p}`);
}

export function hostFromBrowserUrl(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function matchPlaybook(host: string | null): BrowserPlaybook {
  if (!host) return BROWSER_PLAYBOOKS[BROWSER_PLAYBOOKS.length - 1]!;
  for (const playbook of BROWSER_PLAYBOOKS) {
    if (playbook.id === "generic-public") continue;
    if (playbook.hosts.some((pattern) => hostMatchesPlaybook(host, pattern))) return playbook;
  }
  return BROWSER_PLAYBOOKS[BROWSER_PLAYBOOKS.length - 1]!;
}

export function listBrowserPlaybooks(): Array<{ id: string; hosts: string[]; actions: BrowserActAction[] }> {
  return BROWSER_PLAYBOOKS.map((playbook) => ({
    id: playbook.id,
    hosts: playbook.hosts,
    actions: [...playbook.actions],
  }));
}

export function urlLooksLikeLoginWall(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true;
    return LOGIN_PATH.test(parsed.pathname + parsed.search);
  } catch {
    return true;
  }
}

export function planBrowserAct(input: BrowserActInput): BrowserActPlan {
  const host = hostFromBrowserUrl(input.url);
  const playbook = matchPlaybook(host);
  const requested = input.actions?.length ? [...input.actions] : (["extract_after_render"] as BrowserActAction[]);
  const allowed = [...playbook.actions];
  const denied: string[] = [];
  const actionsToRun: BrowserActAction[] = [];
  const warnings: string[] = [];

  for (const action of requested) {
    if (isDeniedBrowserAction(action)) {
      denied.push(action);
      continue;
    }
    if (!allowed.includes(action)) {
      denied.push(action);
      warnings.push(`${action} is not in playbook ${playbook.id} for ${host || "unknown-host"}.`);
      continue;
    }
    actionsToRun.push(action);
  }

  const blocked = urlLooksLikeLoginWall(input.url);
  const clicky = actionsToRun.some((action) => (BROWSER_CLICK_ACTIONS as readonly string[]).includes(action));

  return {
    url: input.url,
    host,
    playbookId: playbook.id,
    requested,
    allowed,
    denied,
    actionsToRun,
    requiresApproval: clicky,
    blocked,
    blockReason: blocked ? "blocked_or_login_wall" : null,
    warnings,
    maxSteps: input.maxSteps ?? 6,
    timeoutMs: input.timeoutMs ?? 15_000,
  };
}

/** True when any planned action clicks. extract_after_render alone may run unaided. */
export function browserActRequiresApproval(input: BrowserActInput): boolean {
  return planBrowserAct(input).requiresApproval;
}

/** CSS / role hints the worker may try. Never password, payment, or file inputs. */
export const ACTION_SELECTORS: Record<Exclude<BrowserActAction, "scroll_to_load" | "extract_after_render">, {
  css: string[];
  names: RegExp[];
}> = {
  dismiss_cookie_banner: {
    css: [
      "#onetrust-accept-btn-handler",
      "#onetrust-accept-btn-handler-main",
      "button[id*='cookie'][id*='accept' i]",
      "button[class*='cookie'][class*='accept' i]",
      "[data-testid*='cookie-accept' i]",
      "button[aria-label*='accept cookies' i]",
    ],
    names: [/accept( all)?( cookies)?/i, /agree/i, /got it/i, /allow all/i],
  },
  expand_description: {
    css: [
      "button[data-testid*='description' i]",
      "button[class*='show-more' i]",
      "button[class*='read-more' i]",
      "a[class*='show-more' i]",
    ],
    names: [/show more/i, /read more/i, /see more/i, /view more/i, /more details/i],
  },
  open_listing_gallery: {
    css: [
      "button[data-testid*='gallery' i]",
      "button[class*='gallery' i]",
      "a[class*='photos' i]",
    ],
    names: [/see all photos/i, /view (all )?photos/i, /gallery/i, /photos/i],
  },
};

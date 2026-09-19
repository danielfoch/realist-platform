import { describe, expect, it } from "vitest";
import {
  BROWSER_DENIED_ACTIONS,
  browserActInputSchema,
  browserActRequiresApproval,
  isDeniedBrowserAction,
  listBrowserPlaybooks,
  matchPlaybook,
  planBrowserAct,
  urlLooksLikeLoginWall,
} from "./browserAct";

describe("browser playbook allowlist", () => {
  it("gives known listing portals the full public playbook", () => {
    expect(matchPlaybook("www.zillow.com").id).toBe("zillow");
    expect(matchPlaybook("realtor.ca").actions).toEqual(expect.arrayContaining([
      "dismiss_cookie_banner",
      "expand_description",
      "open_listing_gallery",
      "scroll_to_load",
      "extract_after_render",
    ]));
    expect(matchPlaybook("www.rightmove.co.uk").id).toBe("rightmove-uk");
  });

  it("limits unknown hosts to extract_after_render", () => {
    const playbook = matchPlaybook("random-blog.example");
    expect(playbook.id).toBe("generic-public");
    expect(playbook.actions).toEqual(["extract_after_render"]);
  });

  it("lists playbooks without an open-ended do-anything entry", () => {
    const ids = listBrowserPlaybooks().map((item) => item.id);
    expect(ids).toContain("zillow");
    expect(ids).toContain("generic-public");
    expect(ids).not.toContain("arbitrary");
  });

  it("plans extract-only without approval", () => {
    const plan = planBrowserAct({ url: "https://www.zillow.com/homedetails/1" });
    expect(plan.actionsToRun).toEqual(["extract_after_render"]);
    expect(plan.requiresApproval).toBe(false);
    expect(browserActRequiresApproval({ url: "https://www.zillow.com/homedetails/1" })).toBe(false);
  });

  it("requires approval when any click action will run", () => {
    const plan = planBrowserAct({
      url: "https://www.zillow.com/homedetails/1",
      actions: ["dismiss_cookie_banner", "extract_after_render"],
    });
    expect(plan.requiresApproval).toBe(true);
    expect(plan.actionsToRun).toEqual(["dismiss_cookie_banner", "extract_after_render"]);
  });

  it("drops click actions that the host playbook does not allow", () => {
    const plan = planBrowserAct({
      url: "https://example.net/listing/1",
      actions: ["dismiss_cookie_banner", "extract_after_render"],
    });
    expect(plan.playbookId).toBe("generic-public");
    expect(plan.denied).toContain("dismiss_cookie_banner");
    expect(plan.actionsToRun).toEqual(["extract_after_render"]);
    expect(plan.requiresApproval).toBe(false);
    expect(plan.warnings[0]).toMatch(/not in playbook/);
  });
});

describe("browser denylist", () => {
  it("flags login, password, payment, captcha, upload, and email intents", () => {
    for (const action of BROWSER_DENIED_ACTIONS) {
      expect(isDeniedBrowserAction(action)).toBe(true);
    }
    expect(isDeniedBrowserAction("extract_after_render")).toBe(false);
    expect(isDeniedBrowserAction("dismiss_cookie_banner")).toBe(false);
  });

  it("rejects denied action names at the job input boundary", () => {
    const parsed = browserActInputSchema.safeParse({
      url: "https://www.zillow.com/homedetails/1",
      actions: ["login"],
    });
    expect(parsed.success).toBe(false);
  });

  it("blocks login / checkout / webform URLs before any click", () => {
    expect(urlLooksLikeLoginWall("https://www.zillow.com/login")).toBe(true);
    expect(urlLooksLikeLoginWall("https://realtor.ca/signin")).toBe(true);
    expect(urlLooksLikeLoginWall("https://board.example/webforms/offer")).toBe(true);
    expect(urlLooksLikeLoginWall("https://shop.example/checkout")).toBe(true);
    expect(urlLooksLikeLoginWall("https://www.zillow.com/homedetails/14-canal/1_zpid/")).toBe(false);
  });

  it("marks login-wall URLs blocked on the plan", () => {
    const plan = planBrowserAct({ url: "https://www.zillow.com/login" });
    expect(plan.blocked).toBe(true);
    expect(plan.blockReason).toBe("blocked_or_login_wall");
  });
});

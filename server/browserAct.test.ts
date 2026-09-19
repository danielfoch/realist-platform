import { afterEach, describe, expect, it } from "vitest";
import { createMemoryBrowserDriver, previewBrowserAct, runBrowserAct, setBrowserDriverFactory, BrowserActError } from "./browserAct";

const PUBLIC_HTML = `
<html><head>
<script type="application/ld+json">
{"@type":"Offer","price":"450000","priceCurrency":"GBP","url":"https://www.rightmove.co.uk/properties/1"}
</script>
<meta property="og:title" content="14 Canal Street">
</head><body><h1>14 Canal Street</h1><button>Accept cookies</button></body></html>
`;

const LOGIN_HTML = `
<html><body>
<h1>Sign in</h1>
<form><input type="password" name="password"><button>Log in</button></form>
<p>Login required to continue</p>
</body></html>
`;

afterEach(() => {
  setBrowserDriverFactory(null);
});

describe("browser.act worker (mocked driver)", () => {
  it("extracts after a mocked render without inventing facts", async () => {
    setBrowserDriverFactory(async () => createMemoryBrowserDriver({
      html: PUBLIC_HTML,
      url: "https://www.rightmove.co.uk/properties/1",
    }));

    const result = await runBrowserAct({
      url: "https://www.rightmove.co.uk/properties/1",
      actions: ["extract_after_render"],
    });

    expect(result.actionsTaken).toEqual(["extract_after_render"]);
    expect(result.extracted?.listing).toEqual(expect.objectContaining({ listPrice: 450000, currency: "GBP" }));
    expect(result.playbookId).toBe("rightmove-uk");
  });

  it("runs cookie dismiss then extract when the playbook allows it", async () => {
    setBrowserDriverFactory(async () => createMemoryBrowserDriver({
      html: PUBLIC_HTML,
      url: "https://www.zillow.com/homedetails/1",
      clicks: { dismiss_cookie_banner: true },
    }));

    const result = await runBrowserAct({
      url: "https://www.zillow.com/homedetails/1",
      actions: ["dismiss_cookie_banner", "extract_after_render"],
    });

    expect(result.actionsTaken).toEqual(["dismiss_cookie_banner", "extract_after_render"]);
    expect(result.extracted?.listing?.listPrice).toBe(450000);
  });

  it("returns blocked_or_login_wall when the rendered page is a login form", async () => {
    setBrowserDriverFactory(async () => createMemoryBrowserDriver({
      html: LOGIN_HTML,
      url: "https://www.zillow.com/homedetails/1",
    }));

    await expect(runBrowserAct({
      url: "https://www.zillow.com/homedetails/1",
      actions: ["extract_after_render"],
    })).rejects.toMatchObject({ code: "blocked_or_login_wall" });
  });

  it("aborts if a click navigates onto a login URL", async () => {
    setBrowserDriverFactory(async () => createMemoryBrowserDriver({
      html: PUBLIC_HTML,
      url: "https://www.zillow.com/homedetails/1",
      loginAfterClick: true,
    }));

    await expect(runBrowserAct({
      url: "https://www.zillow.com/homedetails/1",
      actions: ["dismiss_cookie_banner", "extract_after_render"],
    })).rejects.toBeInstanceOf(BrowserActError);
  });

  it("previews clicks without launching a driver", () => {
    const preview = previewBrowserAct({
      url: "https://www.zillow.com/homedetails/1",
      actions: ["dismiss_cookie_banner", "extract_after_render"],
    });
    expect(preview.dryRun).toBe(true);
    expect(preview.plan.requiresApproval).toBe(true);
    expect(preview.actionsTaken).toEqual([]);
    expect(preview.warnings.join(" ")).toMatch(/needs_approval/);
  });

  it("rejects login URLs at preview", () => {
    expect(() => previewBrowserAct({ url: "https://www.zillow.com/login" })).toThrow(/login/i);
  });
});

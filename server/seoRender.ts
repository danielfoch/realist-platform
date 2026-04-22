import { storage } from "./storage";
import { getProgrammaticMarket, getProgrammaticStrategy, PROGRAMMATIC_MARKETS, PROGRAMMATIC_STRATEGIES } from "@shared/programmaticSeo";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function renderShell(content: string): string {
  return `
    <section style="padding:48px 16px 24px;max-width:1120px;margin:0 auto;font-family:Inter,system-ui,sans-serif;color:#111827;">
      ${content}
    </section>
  `;
}

function renderLinkList(links: Array<{ href: string; label: string }>) {
  return `
    <ul style="padding-left:18px;line-height:1.8;margin:12px 0;">
      ${links.map((link) => `<li><a href="${escapeHtml(link.href)}" style="color:#0f766e;text-decoration:none;">${escapeHtml(link.label)}</a></li>`).join("")}
    </ul>
  `;
}

const STATIC_DATA_PAGE_CONTENT: Record<string, { h1: string; intro: string; sections: Array<{ title: string; body: string }>; links: Array<{ href: string; label: string }> }> = {
  "/insights/market-report": {
    h1: "Canadian Housing Market Report",
    intro: "Realist tracks pricing, inventory, yields, rents, and investor-facing housing signals across major Canadian markets. This page is designed as an indexable content surface first, with the interactive dashboard layered on top for product users.",
    sections: [
      {
        title: "What this page covers",
        body: "National housing context, market-level yield direction, rent signals, and investor-relevant comparisons across Canadian cities.",
      },
      {
        title: "How to use it",
        body: "Use this page to identify which markets deserve deeper underwriting, then move into the analyzer, cap-rate tools, or city-specific reports.",
      },
    ],
    links: [
      { href: "/reports", label: "Browse reports" },
      { href: "/markets/toronto", label: "Toronto market page" },
      { href: "/tools/analyzer", label: "Open deal analyzer" },
    ],
  },
  "/insights/gta-precon-pricing": {
    h1: "GTA Pre-Construction Pricing Report",
    intro: "This report tracks floorplan-level pricing moves in the GTA pre-construction market, with an emphasis on cuts versus raises, project-level movement, and what those changes may imply for investors and end users.",
    sections: [
      {
        title: "Why it matters",
        body: "Pre-construction repricing often leads resale weakness or stabilization, especially in investor-heavy product segments.",
      },
      {
        title: "What to watch",
        body: "Price-cut concentration, project-specific discounting, and which municipalities or product types are repricing fastest.",
      },
    ],
    links: [
      { href: "/canada-housing-market", label: "Canada housing market overview" },
      { href: "/toronto-housing-market", label: "Toronto housing market page" },
      { href: "/reports", label: "All reports" },
    ],
  },
  "/insights/new-construction-canada": {
    h1: "Canada New Construction Report",
    intro: "Realist's new construction report is an indexable national snapshot of active development inventory, pricing, and investor-relevant supply signals across Canada.",
    sections: [
      { title: "Coverage", body: "National and province-level inventory context, pricing direction, and new-build concentration by market." },
      { title: "Investor use case", body: "Use this page to understand where supply pressure may affect resale, rents, and underwriting assumptions." },
    ],
    links: [
      { href: "/reports", label: "All reports" },
      { href: "/markets/toronto", label: "Toronto market page" },
      { href: "/investing/buy-and-hold", label: "Buy and hold strategy page" },
    ],
  },
  "/insights/distress-report": {
    h1: "Canadian Distress Deals Report",
    intro: "This report summarizes distress-related listing signals across Canada, including power of sale, foreclosure, motivated-seller language, and related opportunity patterns.",
    sections: [
      { title: "Why it exists", body: "Distress is one of the clearest sourcing signals for investors, but it needs context and careful verification." },
      { title: "How to use it", body: "Use this page to identify markets or patterns worth following, then inspect live listings in the Distress Deals Browser." },
    ],
    links: [
      { href: "/tools/distress-deals", label: "Open Distress Deals Browser" },
      { href: "/reports", label: "All reports" },
      { href: "/investing/distress", label: "Distress investing strategy page" },
    ],
  },
  "/insights/mortgage-rates": {
    h1: "Canadian Mortgage Rates",
    intro: "This page tracks current mortgage rate context for investors and owner-occupiers, with a focus on how financing conditions affect acquisition and refinancing decisions.",
    sections: [
      { title: "Why investors care", body: "Mortgage rate changes affect debt service, cash flow, refinancing economics, and the relative attractiveness of different markets and strategies." },
      { title: "What to do next", body: "Use rates as an underwriting input, not as a standalone decision driver. Pair rate context with property-level analysis." },
    ],
    links: [
      { href: "/tools/analyzer", label: "Open deal analyzer" },
      { href: "/investing/brrr", label: "BRRR strategy page" },
      { href: "/reports", label: "Browse reports" },
    ],
  },
};

export async function renderSeoFallback(reqPath: string): Promise<string | null> {
  if (reqPath === "/") {
    const latestReports = await storage.getBlogPosts({ status: "published", category: "market-analysis", limit: 4 });
    return renderShell(`
      <header style="margin-bottom:32px;">
        <p style="display:inline-block;border:1px solid #d1d5db;border-radius:999px;padding:6px 10px;font-size:12px;margin-bottom:14px;">Canadian real estate intelligence platform</p>
        <h1 style="font-size:clamp(2.5rem,5vw,4.5rem);line-height:1.05;margin:0 0 14px;">Source the deal. Underwrite it. Act with better housing data.</h1>
        <p style="font-size:18px;line-height:1.7;max-width:760px;color:#4b5563;">
          Realist combines investor tools, reports, and market pages into one crawlable intelligence layer for Canadian real estate. Search opportunities, analyze properties, and follow the policy and pricing signals that matter.
        </p>
      </header>
      <section style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin:32px 0;">
        ${[
          { title: "Reports", body: "Indexable market reports and housing intelligence pages.", href: "/reports" },
          { title: "Markets", body: "City-level market pages built for future programmatic SEO.", href: "/markets" },
          { title: "Strategies", body: "Investor strategy pages linked to markets and tools.", href: "/investing" },
          { title: "Analyzer", body: "Property-level underwriting for Canadian investors.", href: "/tools/analyzer" },
        ].map((item) => `
          <article style="border:1px solid #e5e7eb;border-radius:16px;padding:18px;">
            <h2 style="font-size:20px;margin:0 0 10px;">${escapeHtml(item.title)}</h2>
            <p style="margin:0 0 12px;color:#4b5563;line-height:1.6;">${escapeHtml(item.body)}</p>
            <a href="${item.href}" style="color:#0f766e;text-decoration:none;">Explore ${escapeHtml(item.title.toLowerCase())}</a>
          </article>
        `).join("")}
      </section>
      <section style="margin-top:40px;">
        <h2 style="font-size:28px;margin-bottom:12px;">Latest Reports</h2>
        ${renderLinkList(latestReports.map((report) => ({ href: `/reports/${report.slug}`, label: report.title })))}
      </section>
    `);
  }

  if (reqPath === "/reports") {
    const reports = await storage.getBlogPosts({ status: "published", category: "market-analysis", limit: 24 });
    return renderShell(`
      <header>
        <h1 style="font-size:40px;margin:0 0 12px;">Canadian Real Estate Reports</h1>
        <p style="font-size:18px;color:#4b5563;max-width:760px;line-height:1.7;">This report index is designed to be crawlable and useful without JavaScript. Each report page includes stable URLs, article metadata, and internal links into relevant markets and strategies.</p>
      </header>
      ${renderLinkList(reports.map((report) => ({ href: `/reports/${report.slug}`, label: report.title })))}
    `);
  }

  if (reqPath === "/insights/blog") {
    const posts = await storage.getBlogPosts({ status: "published", limit: 16 });
    return renderShell(`
      <header>
        <h1 style="font-size:40px;margin:0 0 12px;">Realist Blog & Research</h1>
        <p style="font-size:18px;color:#4b5563;max-width:760px;line-height:1.7;">Original Canadian real estate analysis, investor research, and market commentary from Realist.</p>
      </header>
      ${renderLinkList(posts.map((post) => ({ href: post.category === "market-analysis" ? `/reports/${post.slug}` : `/insights/blog/${post.slug}`, label: post.title })))}
    `);
  }

  const reportMatch = reqPath.match(/^\/reports\/([^/]+)$/);
  if (reportMatch) {
    const post = await storage.getBlogPostBySlug(reportMatch[1]);
    if (!post) return null;
    const related = await storage.getBlogPosts({ status: "published", category: post.category, limit: 4 });
    return renderShell(`
      <article>
        <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;">Report</p>
        <h1 style="font-size:42px;line-height:1.1;margin:8px 0 14px;">${escapeHtml(post.title)}</h1>
        <p style="font-size:18px;color:#4b5563;line-height:1.7;max-width:760px;">${escapeHtml(post.excerpt)}</p>
        <div style="margin:18px 0 28px;font-size:14px;color:#6b7280;">
          ${escapeHtml(post.authorName)}${post.publishedAt ? ` · ${new Date(post.publishedAt).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}` : ""}
        </div>
        <section style="font-size:16px;line-height:1.8;color:#111827;">
          ${post.content}
        </section>
      </article>
      <section style="margin-top:40px;">
        <h2 style="font-size:28px;margin-bottom:12px;">Related Reports</h2>
        ${renderLinkList(related.filter((item) => item.slug !== post.slug).map((item) => ({ href: `/reports/${item.slug}`, label: item.title })))}
      </section>
    `);
  }

  const guideMatch = reqPath.match(/^\/insights\/guides\/([^/]+)$/);
  if (guideMatch) {
    const guide = await storage.getGuideBySlug(guideMatch[1]);
    if (!guide) return null;
    return renderShell(`
      <article>
        <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;">Guide</p>
        <h1 style="font-size:42px;line-height:1.1;margin:8px 0 14px;">${escapeHtml(guide.title)}</h1>
        <p style="font-size:18px;color:#4b5563;line-height:1.7;max-width:760px;">${escapeHtml(guide.excerpt)}</p>
        <section style="font-size:16px;line-height:1.8;color:#111827;">${guide.content}</section>
      </article>
    `);
  }

  if (reqPath === "/insights/guides") {
    const guides = await storage.getGuides({ status: "published" });
    return renderShell(`
      <header>
        <h1 style="font-size:40px;margin:0 0 12px;">Canadian Real Estate Guides</h1>
        <p style="font-size:18px;color:#4b5563;max-width:760px;line-height:1.7;">Guides built to answer recurring investor questions around financing, taxes, strategy, and execution in Canada.</p>
      </header>
      ${renderLinkList(guides.map((guide) => ({ href: `/insights/guides/${guide.slug}`, label: guide.title })))}
    `);
  }

  if (reqPath === "/markets") {
    return renderShell(`
      <header>
        <h1 style="font-size:40px;margin:0 0 12px;">Canadian Real Estate Markets</h1>
        <p style="font-size:18px;color:#4b5563;max-width:760px;line-height:1.7;">These market pages form the programmatic SEO foundation for Realist. Each page links market context to tools, reports, and strategy pages.</p>
      </header>
      ${renderLinkList(PROGRAMMATIC_MARKETS.map((market) => ({ href: `/markets/${market.slug}`, label: `${market.city}, ${market.province}` })))}
    `);
  }

  const marketMatch = reqPath.match(/^\/markets\/([^/]+)$/);
  if (marketMatch) {
    const market = getProgrammaticMarket(marketMatch[1]);
    if (!market) return null;
    return renderShell(`
      <article>
        <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;">Market Page</p>
        <h1 style="font-size:42px;line-height:1.1;margin:8px 0 14px;">${escapeHtml(market.title)}</h1>
        <p style="font-size:18px;color:#4b5563;line-height:1.7;max-width:760px;">${escapeHtml(market.intro)}</p>
        <h2 style="font-size:28px;margin:32px 0 10px;">Key Takeaways</h2>
        <ul style="padding-left:18px;line-height:1.8;">${market.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        <h2 style="font-size:28px;margin:32px 0 10px;">Related Strategy Pages</h2>
        ${renderLinkList(market.relatedStrategies.map((strategy) => ({ href: `/investing/${strategy}`, label: strategy.replace(/-/g, " ") })))}
        <h2 style="font-size:28px;margin:32px 0 10px;">Investor Workflows</h2>
        ${renderLinkList([
          { href: "/tools/analyzer", label: "Analyze a property" },
          { href: "/reports", label: "Browse reports" },
          { href: "/tools/cap-rates", label: "Explore cap rates" },
        ])}
      </article>
    `);
  }

  if (reqPath === "/investing") {
    return renderShell(`
      <header>
        <h1 style="font-size:40px;margin:0 0 12px;">Canadian Real Estate Investing Strategies</h1>
        <p style="font-size:18px;color:#4b5563;max-width:760px;line-height:1.7;">These strategy pages are designed to connect search intent to Realist tools, markets, and reports in a stable indexable structure.</p>
      </header>
      ${renderLinkList(PROGRAMMATIC_STRATEGIES.map((strategy) => ({ href: `/investing/${strategy.slug}`, label: strategy.title })))}
    `);
  }

  const strategyMatch = reqPath.match(/^\/investing\/([^/]+)$/);
  if (strategyMatch) {
    const strategy = getProgrammaticStrategy(strategyMatch[1]);
    if (!strategy) return null;
    return renderShell(`
      <article>
        <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;">Strategy Page</p>
        <h1 style="font-size:42px;line-height:1.1;margin:8px 0 14px;">${escapeHtml(strategy.title)}</h1>
        <p style="font-size:18px;color:#4b5563;line-height:1.7;max-width:760px;">${escapeHtml(strategy.intro)}</p>
        <h2 style="font-size:28px;margin:32px 0 10px;">Key Ideas</h2>
        <ul style="padding-left:18px;line-height:1.8;">${strategy.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        <h2 style="font-size:28px;margin:32px 0 10px;">Relevant Markets</h2>
        ${renderLinkList(strategy.relatedMarkets.map((market) => ({ href: `/markets/${market}`, label: market.replace(/-/g, " ") })))}
      </article>
    `);
  }

  const staticPage = STATIC_DATA_PAGE_CONTENT[reqPath];
  if (staticPage) {
    return renderShell(`
      <article>
        <h1 style="font-size:42px;line-height:1.1;margin:8px 0 14px;">${escapeHtml(staticPage.h1)}</h1>
        <p style="font-size:18px;color:#4b5563;line-height:1.7;max-width:760px;">${escapeHtml(staticPage.intro)}</p>
        ${staticPage.sections.map((section) => `
          <section style="margin-top:28px;">
            <h2 style="font-size:28px;margin:0 0 8px;">${escapeHtml(section.title)}</h2>
            <p style="font-size:16px;line-height:1.8;color:#111827;">${escapeHtml(section.body)}</p>
          </section>
        `).join("")}
        <section style="margin-top:32px;">
          <h2 style="font-size:28px;margin-bottom:10px;">Related Pages</h2>
          ${renderLinkList(staticPage.links)}
        </section>
      </article>
    `);
  }

  return null;
}

import { storage } from "./storage";
import { encyclopediaGuides, getEncyclopediaGuide } from "@shared/encyclopedia";
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

function renderFooterLinks() {
  return `
    <footer style="border-top:1px solid #e5e7eb;margin-top:48px;padding-top:24px;">
      <nav aria-label="Footer links">
        ${renderLinkList([
          { href: "/markets", label: "Markets" },
          { href: "/reports", label: "Reports" },
          { href: "/investing", label: "Investing" },
          { href: "/about", label: "About" },
          { href: "/about/contact", label: "Contact" },
          { href: "/insights/podcast", label: "Podcast" },
          { href: "https://thecanadianrealestateinvestor.substack.com/feed", label: "RSS" },
        ])}
      </nav>
    </footer>
  `;
}

function renderBreadcrumbs(links: Array<{ href: string; label: string }>) {
  return `
    <nav aria-label="Breadcrumb" style="font-size:14px;margin-bottom:20px;color:#4b5563;">
      ${links.map((link, index) => {
        const prefix = index === 0 ? "" : " / ";
        return `${prefix}<a href="${escapeHtml(link.href)}" style="color:#0f766e;text-decoration:none;">${escapeHtml(link.label)}</a>`;
      }).join("")}
    </nav>
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
  "/insights/motivated-report": {
    h1: "Canadian Motivated Sellers Report",
    intro: "This report summarizes motivated-seller listing signals across Canada, including power of sale, foreclosure, motivated-seller language, and related opportunity patterns.",
    sections: [
      { title: "Why it exists", body: "Motivated-seller language is one of the clearest sourcing signals for investors, but it needs context and careful verification." },
      { title: "How to use it", body: "Use this page to identify markets or patterns worth following, then inspect live listings in the Motivated Deals Browser." },
    ],
    links: [
      { href: "/tools/motivated-deals", label: "Open Motivated Deals Browser" },
      { href: "/reports", label: "All reports" },
      { href: "/investing/distress", label: "Motivated-seller investing strategy page" },
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
  "/tools/hst-rebate": {
    h1: "Ontario New Home HST Rebate Calculator",
    intro: "Estimate how much a buyer could save under the proposed Ontario HST relief policy for new homes. This public calculator is a prototype based on the March 30, 2026 federal/Ontario announcement and current CRA rebate mechanics.",
    sections: [
      {
        title: "Policy assumptions",
        body: "The calculator assumes full 13% HST relief up to $1,000,000, a $130,000 maximum rebate up to $1,500,000, a linear taper to $24,000 at $1,850,000, and a $24,000 floor above that level until final guidance says otherwise.",
      },
      {
        title: "Implementation status",
        body: "Final eligibility, buyer application process, builder-credit mechanics, and closing-document requirements may change pending royal assent and formal implementation guidance.",
      },
    ],
    links: [
      { href: "https://www.pm.gc.ca/en/news/news-releases/2026/03/30/prime-minister-carney-secures-new-partnership-ontario-cut-taxes", label: "Read the policy announcement" },
      { href: "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/gst-hst-rebates/first-time-home-buyers-gst-hst-rebate.html", label: "Review current CRA GST/HST rebate guidance" },
      { href: "/tools/true-cost", label: "Open the True Cost calculator" },
    ],
  },
};

export async function renderSeoFallback(reqPath: string): Promise<string | null> {
  if (reqPath === "/") {
    const latestReports = await storage.getBlogPosts({ status: "published", category: "market-analysis", limit: 6 });
    return renderShell(`
      <header style="margin-bottom:32px;">
        <p style="display:inline-block;border:1px solid #d1d5db;border-radius:999px;padding:6px 10px;font-size:12px;margin-bottom:14px;">AI real estate deal finder for Canada</p>
        <h1 style="font-size:clamp(2.5rem,5vw,4.5rem);line-height:1.05;margin:0 0 14px;">Realist helps Canadian investors find and analyze better real estate deals.</h1>
        <p style="font-size:18px;line-height:1.7;max-width:760px;color:#4b5563;">
          Realist combines property-level underwriting, market reports, Canadian housing data, and investor workflows into one research surface. Use it to compare rental properties, screen cap rates, understand market risk, and move from a broad search to a defensible investment decision.
        </p>
      </header>
      <section style="font-size:16px;line-height:1.85;color:#111827;max-width:900px;">
        <p>
          The platform is built for Canadian real estate investors who need more than a listing search. A good acquisition decision depends on rent quality, financing assumptions, local supply, resale liquidity, renovation scope, and the investor's own strategy. Realist organizes those inputs into deal analysis tools, market pages, research reports, and repeatable workflows so buyers can move faster without skipping diligence.
        </p>
        <p>
          The homepage links to the core indexable surfaces Google should understand: reports for market research, markets for city-level context, investing pages for strategy education, and tools for underwriting. Those links are plain HTML anchors in the initial response so crawlers can discover the rest of the site without waiting for client-side JavaScript.
        </p>
        <p>
          Realist's research focus is Canadian housing. Topics include the CREA MLS Home Price Index, sales-to-new-listings ratios, CMHC rental benchmarks, new construction supply, pre-construction price movement, mortgage rates, motivated-seller signals, multiplex policy, BRRR execution, and buy-and-hold underwriting. The goal is not generic real estate content; it is practical Canadian deal analysis that connects market data to investment decisions.
        </p>
        <p>
          Start with a report when you need market context, start with a market page when you are comparing cities, and start with the analyzer when a specific property is ready for diligence. Realist keeps those paths connected so a search for an AI real estate deal finder, a CREA housing indicator, or a local investment market can lead to the same practical workflow.
        </p>
      </section>
      <section style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin:32px 0;">
        ${[
          { title: "Analyze a Deal", body: "Turn an address, listing, or MLS number into cash flow, cap rate, cash-on-cash return, risk signals, financing sensitivity, and next steps.", href: "/tools/analyzer" },
          { title: "Explore the Map", body: "Search Canadian listings through an investor lens with yield, market fit, price movement, property type, and risk context.", href: "/tools/cap-rates" },
          { title: "Motivated Deals", body: "Browse motivated seller, power of sale, foreclosure, court ordered sale, and related opportunity language before it becomes obvious to everyone else.", href: "/tools/motivated-deals" },
          { title: "Market Intelligence", body: "Follow market reports, city pages, strategy pages, and housing data that shape underwriting assumptions for Canadian investors.", href: "/insights" },
        ].map((item) => `
          <article style="border:1px solid #e5e7eb;border-radius:16px;padding:18px;">
            <h2 style="font-size:20px;margin:0 0 10px;">${escapeHtml(item.title)}</h2>
            <p style="margin:0 0 12px;color:#4b5563;line-height:1.6;">${escapeHtml(item.body)}</p>
            <a href="${item.href}" style="color:#0f766e;text-decoration:none;">Explore ${escapeHtml(item.title.toLowerCase())}</a>
          </article>
        `).join("")}
      </section>
      <section style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px;margin:40px 0;font-size:16px;line-height:1.75;">
        <article>
          <h2 style="font-size:28px;margin:0 0 10px;">For deal analysis</h2>
          <p>Use Realist when a property needs disciplined underwriting. The analyzer helps investors compare income, expenses, debt service, vacancy, repairs, reserves, and exit assumptions instead of relying on a headline cap rate. It is especially useful for Canadian rental property, multiplex conversion, BRRR, and buy-and-hold decisions where financing and local rules can change the outcome.</p>
        </article>
        <article>
          <h2 style="font-size:28px;margin:0 0 10px;">For market research</h2>
          <p>Market pages and reports connect search intent to underlying data. A Toronto housing market page should point to condo weakness, pre-construction repricing, multiplex rules, and related reports. A Calgary or Hamilton page should explain yield, affordability, rent depth, and the specific investor use cases that make the market different.</p>
        </article>
        <article>
          <h2 style="font-size:28px;margin:0 0 10px;">For investor workflows</h2>
          <p>Realist is designed around repeatable workflows: define a buy box, screen a market, analyze a property, compare scenarios, read the supporting market report, and decide whether to pursue diligence. That structure gives users clearer decisions and gives search engines a crawlable map of the site's expertise.</p>
        </article>
      </section>
      <section style="margin-top:40px;">
        <h2 style="font-size:28px;margin-bottom:12px;">Featured Canadian Real Estate Reports</h2>
        ${renderLinkList(latestReports.map((report) => ({ href: `/reports/${report.slug}`, label: report.title })))}
      </section>
      <section style="margin-top:40px;">
        <h2 style="font-size:28px;margin-bottom:12px;">Start with a market or strategy</h2>
        ${renderLinkList([
          { href: "/markets/toronto", label: "Toronto real estate investment market" },
          { href: "/markets/hamilton", label: "Hamilton real estate investment market" },
          { href: "/markets/calgary", label: "Calgary real estate investment market" },
          { href: "/investing/multiplex", label: "Multiplex investing in Canada" },
          { href: "/investing/brrr", label: "BRRR real estate investing in Canada" },
          { href: "/investing/distress", label: "Motivated-seller investing in Canada" },
        ])}
      </section>
      <section style="font-size:16px;line-height:1.85;color:#111827;max-width:900px;margin-top:40px;">
        <h2 style="font-size:28px;margin:0 0 10px;">Why Realist exists</h2>
        <p>
          Canadian investors often have to stitch together listings, mortgage assumptions, spreadsheet models, CMHC rent data, local policy notes, realtor commentary, and macro research. That creates friction and makes it easy to miss important details. Realist brings those surfaces closer together so the research path is more consistent from first search to final offer.
        </p>
        <p>
          The content on Realist is updated around the questions investors actually ask: where prices are softening, where rents support leverage, where new supply may pressure resale, how the sales-to-new-listings ratio is changing, what the CREA MLS Home Price Index says about momentum, and whether a specific property can survive conservative assumptions. Each page should answer a specific question and link to the next useful step.
        </p>
      </section>
      ${renderFooterLinks()}
    `);
  }

  if (reqPath === "/insights") {
    const latestReports = await storage.getBlogPosts({ status: "published", category: "market-analysis", limit: 6 });
    return renderShell(`
      <header>
        <h1 style="font-size:40px;margin:0 0 12px;">Canadian Real Estate Insights & Reports</h1>
        <p style="font-size:18px;color:#4b5563;max-width:760px;line-height:1.7;">Original research, market reports, mortgage commentary, and macro analysis for Canadian real estate investors.</p>
      </header>
      <section style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin:28px 0;">
        ${[
          { title: "Reports", body: "Crawlable Canadian housing reports and market intelligence.", href: "/reports" },
          { title: "CMHC Land Use Regulations Report", body: "Analysis of CMHC's 2026 research on zoning, approvals, affordability, and housing supply.", href: "/reports/cmhc-land-use-regulations-housing-canada-2026" },
          { title: "Mortgage Rates", body: "Current Canadian mortgage rate context for investors.", href: "/insights/mortgage-rates" },
          { title: "Motivated Report", body: "Monthly power of sale, foreclosure, and motivated-seller signals.", href: "/insights/motivated-report" },
        ].map((item) => `
          <article style="border:1px solid #e5e7eb;border-radius:16px;padding:18px;">
            <h2 style="font-size:20px;margin:0 0 10px;">${escapeHtml(item.title)}</h2>
            <p style="margin:0 0 12px;color:#4b5563;line-height:1.6;">${escapeHtml(item.body)}</p>
            <a href="${item.href}" style="color:#0f766e;text-decoration:none;">Open</a>
          </article>
        `).join("")}
      </section>
      <section style="margin-top:36px;">
        <h2 style="font-size:28px;margin-bottom:12px;">Latest Reports</h2>
        ${renderLinkList(latestReports.map((report) => ({ href: `/reports/${report.slug}`, label: report.title })))}
      </section>
    `);
  }

  if (reqPath === "/insights") {
    const latestReports = await storage.getBlogPosts({ status: "published", category: "market-analysis", limit: 6 });
    return renderShell(`
      <header>
        <h1 style="font-size:40px;margin:0 0 12px;">Canadian Real Estate Insights & Reports</h1>
        <p style="font-size:18px;color:#4b5563;max-width:760px;line-height:1.7;">Original research, market reports, mortgage commentary, and macro analysis for Canadian real estate investors.</p>
      </header>
      <section style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin:28px 0;">
        ${[
          { title: "Reports", body: "Crawlable Canadian housing reports and market intelligence.", href: "/reports" },
          { title: "CMHC Land Use Regulations Report", body: "Analysis of CMHC's 2026 research on zoning, approvals, affordability, and housing supply.", href: "/reports/cmhc-land-use-regulations-housing-canada-2026" },
          { title: "Mortgage Rates", body: "Current Canadian mortgage rate context for investors.", href: "/insights/mortgage-rates" },
          { title: "Distress Report", body: "Monthly power of sale, foreclosure, and motivated-seller signals.", href: "/insights/distress-report" },
        ].map((item) => `
          <article style="border:1px solid #e5e7eb;border-radius:16px;padding:18px;">
            <h2 style="font-size:20px;margin:0 0 10px;">${escapeHtml(item.title)}</h2>
            <p style="margin:0 0 12px;color:#4b5563;line-height:1.6;">${escapeHtml(item.body)}</p>
            <a href="${item.href}" style="color:#0f766e;text-decoration:none;">Open</a>
          </article>
        `).join("")}
      </section>
      <section style="margin-top:36px;">
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
    const latest = await storage.getBlogPosts({ status: "published", category: "market-analysis", limit: 6 });
    return renderShell(`
      ${renderBreadcrumbs([{ href: "/", label: "Home" }, { href: "/reports", label: "Reports" }, { href: `/reports/${post.slug}`, label: post.title }])}
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
      <section style="margin-top:32px;">
        <h2 style="font-size:28px;margin-bottom:12px;">Latest Reports</h2>
        ${renderLinkList(latest.filter((item) => item.slug !== post.slug).slice(0, 6).map((item) => ({ href: `/reports/${item.slug}`, label: item.title })))}
      </section>
      ${renderFooterLinks()}
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

  if (reqPath === "/insights/encyclopedia") {
    return renderShell(`
      <header>
        <h1 style="font-size:40px;margin:0 0 12px;">Real Estate Investor Encyclopedia</h1>
        <p style="font-size:18px;color:#4b5563;max-width:760px;line-height:1.7;">Plain-English Canadian real estate investing definitions, formulas, examples, caveats, and calculator specs.</p>
      </header>
      ${renderLinkList(encyclopediaGuides.map((guide) => ({ href: guide.canonicalPath, label: guide.title })))}
    `);
  }

  const encyclopediaMatch = reqPath.match(/^\/insights\/encyclopedia\/([^/]+)$/);
  if (encyclopediaMatch) {
    const guide = getEncyclopediaGuide(encyclopediaMatch[1]);
    if (!guide) return null;
    return renderShell(`
      <article>
        <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;">Investor Encyclopedia</p>
        <h1 style="font-size:42px;line-height:1.1;margin:8px 0 14px;">${escapeHtml(guide.title)}</h1>
        <p style="font-size:18px;color:#4b5563;line-height:1.7;max-width:760px;">${escapeHtml(guide.summary)}</p>
        <h2>Definition</h2>
        <p>${escapeHtml(guide.definition)}</p>
        ${guide.formula ? `<h2>Formula</h2><p>${escapeHtml(guide.formula)}</p>` : ""}
        ${guide.example ? `<h2>Example</h2><p>${escapeHtml(guide.example)}</p>` : ""}
        <h2>Why It Matters</h2>
        <p>${escapeHtml(guide.whyItMatters)}</p>
        ${guide.investorInterpretation ? `<h2>Investor Interpretation</h2><p>${escapeHtml(guide.investorInterpretation)}</p>` : ""}
        ${guide.realistTieIn ? `<h2>Realist Tie-In</h2><p>${escapeHtml(guide.realistTieIn)}</p>` : ""}
      </article>
    `);
  }

  if (reqPath === "/markets") {
    return renderShell(`
      <header>
        <h1 style="font-size:40px;margin:0 0 12px;">Canadian Real Estate Markets</h1>
        <p style="font-size:18px;color:#4b5563;max-width:760px;line-height:1.7;">These market pages form the programmatic SEO foundation for Realist. Each page links market context to tools, reports, and strategy pages.</p>
      </header>
      <section style="font-size:16px;line-height:1.85;color:#111827;max-width:900px;margin:24px 0;">
        <p>Realist's Canadian real estate market pages are built for investors comparing cities through an underwriting lens. A market page should explain what kind of investor the city fits, what data deserves attention, and which reports or tools should be used before making an offer.</p>
        <p>The pages below cover pricing context, rent support, policy exposure, supply pressure, and related strategies. They are intentionally linked from one crawlable index so search engines can discover every market without relying on infinite scroll, filters, or client-side routing.</p>
        <p>Use this index as the starting point for city research, then move into the deal analyzer, cap-rate tools, market reports, and investing strategy pages for the next layer of diligence.</p>
      </section>
      ${renderLinkList(PROGRAMMATIC_MARKETS.map((market) => ({ href: `/markets/${market.slug}`, label: `${market.city}, ${market.province}` })))}
      ${renderFooterLinks()}
    `);
  }

  const marketMatch = reqPath.match(/^\/markets\/([^/]+)$/);
  if (marketMatch) {
    const market = getProgrammaticMarket(marketMatch[1]);
    if (!market) return null;
    const updated = new Date().toISOString().slice(0, 10);
    return renderShell(`
      ${renderBreadcrumbs([{ href: "/", label: "Home" }, { href: "/markets", label: "Markets" }, { href: `/markets/${market.slug}`, label: market.city }])}
      <article>
        <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;">Market Page</p>
        <h1 style="font-size:42px;line-height:1.1;margin:8px 0 14px;">${escapeHtml(market.title)}</h1>
        <p style="font-size:14px;color:#6b7280;margin:0 0 12px;">Updated ${updated}</p>
        <p style="font-size:18px;color:#4b5563;line-height:1.7;max-width:760px;">${escapeHtml(market.intro)}</p>
        <section style="font-size:16px;line-height:1.85;color:#111827;max-width:900px;margin-top:28px;">
          <p>${escapeHtml(market.city)} is tracked as a distinct Canadian real estate investment market because pricing, rent depth, financing risk, policy exposure, and investor competition do not move in the same way across cities. Realist's market pages are designed to help investors move from a broad housing-market question to a concrete underwriting workflow.</p>
          <p>For ${escapeHtml(market.city)}, the starting point is not simply whether the market is going up or down. Investors need to understand which property types fit the local rent base, where affordability creates or destroys leverage, how quickly listings trade, and whether the strategy depends on current income, renovation execution, density upside, or long-term land value.</p>
          <p>The page should be read alongside current reports, property-level analysis, and local professional advice. It is intentionally structured with methodology, related reports, related strategies, and crawlable internal links so both users and search engines can understand how this market connects to the rest of Realist's Canadian housing research.</p>
          <p>A useful ${escapeHtml(market.city)} underwriting process starts with the investor's actual buy box. A multiplex buyer cares about lot dimensions, zoning, conversion cost, refinance risk, and rent by unit type. A buy-and-hold investor cares about stabilized income, vacancy, operating costs, debt service, and resale liquidity. A BRRR investor cares about purchase discount, renovation scope, after-repair value, lender treatment, and the probability that capital can be recycled without forcing optimistic rent assumptions.</p>
          <p>Realist uses this page as a research doorway rather than a final answer. The local market may contain strong and weak submarkets at the same time. A city can show soft headline prices while specific rental pockets remain competitive; it can also show strong demand while individual properties fail because the debt, taxes, insurance, repairs, and management assumptions do not leave enough margin of safety.</p>
        </section>
        <h2 style="font-size:28px;margin:32px 0 10px;">Key Takeaways</h2>
        <ul style="padding-left:18px;line-height:1.8;">${market.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        <h2 style="font-size:28px;margin:32px 0 10px;">What Investors Should Watch</h2>
        <p style="font-size:16px;line-height:1.85;color:#111827;max-width:900px;">Watch the relationship between listing price, achievable rent, carrying cost, and the strategy's required execution risk. In ${escapeHtml(market.city)}, a deal that looks attractive on gross yield can still fail after repairs, vacancy, financing, property tax, insurance, utilities, and management are included. The better screen is whether the investment remains reasonable after stress-testing rent, exit value, and interest-rate assumptions.</p>
        <p style="font-size:16px;line-height:1.85;color:#111827;max-width:900px;">Investors should also monitor supply. New construction, condo completions, rental vacancy, and resale inventory can change negotiating power quickly. Where supply is rising, conservative rent growth and a larger contingency are usually more useful than a simple assumption that recent appreciation will continue.</p>
        <h2 style="font-size:28px;margin:32px 0 10px;">Charts and Accessibility</h2>
        <p style="font-size:16px;line-height:1.85;color:#111827;max-width:900px;">When charts are available in the hydrated Realist app, they should describe the metric, time period, and source in adjacent text or image alt text. For search and accessibility, a chart about yields should explain whether it uses gross yield or net yield; a chart about price momentum should explain whether it is based on MLS benchmark prices, listing prices, or project-level pricing data.</p>
        <h2 style="font-size:28px;margin:32px 0 10px;">Historical Trend Context</h2>
        <p style="font-size:16px;line-height:1.85;color:#111827;max-width:900px;">Realist evaluates historical trend through a practical investor lens: changes in price momentum, rent support, supply pressure, and financing conditions. A market with falling prices can still be attractive if rents hold and basis improves; a market with strong demand can still be risky if income does not support debt service. For ${escapeHtml(market.city)}, compare current deal assumptions against recent Canadian housing reports and conservative financing scenarios before treating any trend as investable.</p>
        <h2 style="font-size:28px;margin:32px 0 10px;">Methodology and Sources</h2>
        <p style="font-size:16px;line-height:1.85;color:#111827;max-width:900px;">This market page combines Realist's internal investment framing with public and platform-adjacent housing signals such as CREA market data, CMHC rent benchmarks, municipal policy context, listing inventory, and Realist report archives. The methodology is deliberately conservative: market-level signals identify where diligence should start, while property-level underwriting decides whether a specific acquisition is investable.</p>
        <p style="font-size:16px;line-height:1.85;color:#111827;max-width:900px;">Source citations should be preserved in reports and supporting modules. CREA data is useful for sales, listings, benchmark prices, and market balance. CMHC data is useful for rent and vacancy context. Municipal sources are useful for zoning, approvals, and density permissions. Realist reports connect those inputs to investor decisions, but they do not replace legal, tax, lending, or building-code advice.</p>
        <h2 style="font-size:28px;margin:32px 0 10px;">Related Strategy Pages</h2>
        ${renderLinkList(market.relatedStrategies.map((strategy) => ({ href: `/investing/${strategy}`, label: strategy.replace(/-/g, " ") })))}
        <h2 style="font-size:28px;margin:32px 0 10px;">Related Reports</h2>
        ${renderLinkList((market.relatedReportSlugs.length ? market.relatedReportSlugs : ["new-construction-canada", "gta-precon-pricing"]).map((slug) => ({ href: `/reports/${slug}`, label: slug.replace(/-/g, " ") })))}
        <h2 style="font-size:28px;margin:32px 0 10px;">Investor Workflows</h2>
        ${renderLinkList([
          { href: "/tools/analyzer", label: "Analyze a property" },
          { href: "/reports", label: "Browse reports" },
          { href: "/tools/cap-rates", label: "Explore cap rates" },
        ])}
      </article>
      ${renderFooterLinks()}
    `);
  }

  if (reqPath === "/investing") {
    return renderShell(`
      <header>
        <h1 style="font-size:40px;margin:0 0 12px;">Canadian Real Estate Investing Strategies</h1>
        <p style="font-size:18px;color:#4b5563;max-width:760px;line-height:1.7;">These strategy pages are designed to connect search intent to Realist tools, markets, and reports in a stable indexable structure.</p>
      </header>
      <section style="font-size:16px;line-height:1.85;color:#111827;max-width:900px;margin:24px 0;">
        <p>Realist strategy pages explain how Canadian investors evaluate buy-and-hold, BRRR, multiplex, and motivated-seller opportunities. Each strategy has different risk layers: financing, renovation scope, rent quality, zoning, holding period, exit value, and market liquidity.</p>
        <p>This index also supports Realist's AI real estate deal finder positioning. The search problem is not just finding more listings; it is finding listings that fit a strategy and then testing whether the numbers survive conservative assumptions.</p>
        <p>Start with a strategy below, compare the related markets, then use the analyzer and reports to decide whether a property is worth deeper diligence.</p>
      </section>
      ${renderLinkList(PROGRAMMATIC_STRATEGIES.map((strategy) => ({ href: `/investing/${strategy.slug}`, label: strategy.title })))}
      ${renderFooterLinks()}
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

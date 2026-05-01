import { storage } from "./storage";

const BASE = "https://realist.ca";

type SitemapUrl = {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function dateOnly(value: Date | string | null | undefined) {
  if (!value) return today();
  return new Date(value).toISOString().slice(0, 10);
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlXml(url: SitemapUrl) {
  return [
    "  <url>",
    `    <loc>${escapeXml(url.loc)}</loc>`,
    url.lastmod ? `    <lastmod>${url.lastmod}</lastmod>` : "",
    url.changefreq ? `    <changefreq>${url.changefreq}</changefreq>` : "",
    typeof url.priority === "number" ? `    <priority>${url.priority.toFixed(2)}</priority>` : "",
    "  </url>",
  ].filter(Boolean).join("\n");
}

function urlset(urls: SitemapUrl[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(urlXml).join("\n")}\n</urlset>\n`;
}

export function buildSitemapIndex() {
  const lastmod = today();
  const sitemaps = ["sitemap-pages.xml", "sitemap-reports.xml", "sitemap-podcast.xml"];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemaps.map((name) => `  <sitemap>\n    <loc>${BASE}/${name}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </sitemap>`).join("\n")}\n</sitemapindex>\n`;
}

export async function buildPagesSitemap() {
  const now = today();
  const urls: SitemapUrl[] = [
    { loc: `${BASE}/`, lastmod: now, changefreq: "daily", priority: 1 },
    { loc: `${BASE}/reports`, lastmod: now, changefreq: "weekly", priority: 0.9 },
    { loc: `${BASE}/markets`, lastmod: now, changefreq: "weekly", priority: 0.85 },
    { loc: `${BASE}/investing`, lastmod: now, changefreq: "weekly", priority: 0.85 },
    { loc: `${BASE}/about`, lastmod: now, changefreq: "monthly", priority: 0.9 },
    { loc: `${BASE}/about/contact`, lastmod: now, changefreq: "monthly", priority: 0.6 },
    { loc: `${BASE}/about/shop`, lastmod: now, changefreq: "weekly", priority: 0.6 },
    { loc: `${BASE}/tools`, lastmod: now, changefreq: "weekly", priority: 0.9 },
    { loc: `${BASE}/tools/analyzer`, lastmod: now, changefreq: "weekly", priority: 0.95 },
    { loc: `${BASE}/tools/buybox`, lastmod: now, changefreq: "weekly", priority: 0.7 },
    { loc: `${BASE}/tools/coinvest`, lastmod: now, changefreq: "weekly", priority: 0.7 },
    { loc: `${BASE}/tools/true-cost`, lastmod: now, changefreq: "monthly", priority: 0.8 },
    { loc: `${BASE}/tools/hst-rebate`, lastmod: now, changefreq: "monthly", priority: 0.8 },
    { loc: `${BASE}/tools/rent-vs-buy`, lastmod: now, changefreq: "monthly", priority: 0.8 },
    { loc: `${BASE}/tools/cap-rates`, lastmod: now, changefreq: "weekly", priority: 0.8 },
    { loc: `${BASE}/tools/will-it-plex`, lastmod: now, changefreq: "monthly", priority: 0.7 },
    { loc: `${BASE}/tools/fixed-vs-variable`, lastmod: now, changefreq: "weekly", priority: 0.7 },
    { loc: `${BASE}/tools/land-claim-screener`, lastmod: now, changefreq: "monthly", priority: 0.7 },
    { loc: `${BASE}/tools/distress-deals`, lastmod: now, changefreq: "daily", priority: 0.8 },
    { loc: `${BASE}/course`, lastmod: now, changefreq: "weekly", priority: 0.9 },
    { loc: `${BASE}/community`, lastmod: now, changefreq: "weekly", priority: 0.8 },
    { loc: `${BASE}/community/leaderboard`, lastmod: now, changefreq: "daily", priority: 0.8 },
    { loc: `${BASE}/community/events`, lastmod: now, changefreq: "weekly", priority: 0.8 },
    { loc: `${BASE}/community/network`, lastmod: now, changefreq: "weekly", priority: 0.7 },
    { loc: `${BASE}/insights`, lastmod: now, changefreq: "weekly", priority: 0.9 },
    { loc: `${BASE}/insights/market-report`, lastmod: now, changefreq: "weekly", priority: 0.9 },
    { loc: `${BASE}/insights/distress-report`, lastmod: now, changefreq: "daily", priority: 0.85 },
    { loc: `${BASE}/insights/mortgage-rates`, lastmod: now, changefreq: "daily", priority: 0.85 },
    { loc: `${BASE}/insights/building-permits`, lastmod: now, changefreq: "monthly", priority: 0.8 },
    { loc: `${BASE}/insights/productivity-gap`, lastmod: now, changefreq: "monthly", priority: 0.7 },
    { loc: `${BASE}/insights/new-construction-canada`, lastmod: now, changefreq: "weekly", priority: 0.85 },
    { loc: `${BASE}/insights/gta-precon-pricing`, lastmod: now, changefreq: "weekly", priority: 0.85 },
    { loc: `${BASE}/insights/cpi-march-2026`, lastmod: now, changefreq: "monthly", priority: 0.8 },
    { loc: `${BASE}/insights/the-spread-that-ate-the-economy`, lastmod: now, changefreq: "monthly", priority: 0.8 },
    { loc: `${BASE}/insights/spring-economic-update-2026`, lastmod: now, changefreq: "monthly", priority: 0.8 },
    { loc: `${BASE}/canada-housing-market`, lastmod: now, changefreq: "weekly", priority: 0.9 },
    { loc: `${BASE}/toronto-housing-market`, lastmod: now, changefreq: "weekly", priority: 0.9 },
    { loc: `${BASE}/toronto-condo-prices-dropping`, lastmod: now, changefreq: "weekly", priority: 0.85 },
    { loc: `${BASE}/biggest-price-drops-gta`, lastmod: now, changefreq: "daily", priority: 0.85 },
    { loc: `${BASE}/insights/blog`, lastmod: now, changefreq: "weekly", priority: 0.8 },
    { loc: `${BASE}/insights/guides`, lastmod: now, changefreq: "weekly", priority: 0.8 },
    { loc: `${BASE}/join/realtors`, lastmod: now, changefreq: "monthly", priority: 0.7 },
    { loc: `${BASE}/join/lenders`, lastmod: now, changefreq: "monthly", priority: 0.7 },
  ];

  const { PROGRAMMATIC_MARKETS, PROGRAMMATIC_STRATEGIES } = await import("@shared/programmaticSeo");
  for (const market of PROGRAMMATIC_MARKETS) {
    urls.push({ loc: `${BASE}/markets/${market.slug}`, lastmod: now, changefreq: "weekly", priority: 0.72 });
  }
  for (const strategy of PROGRAMMATIC_STRATEGIES) {
    urls.push({ loc: `${BASE}/investing/${strategy.slug}`, lastmod: now, changefreq: "weekly", priority: 0.72 });
  }

  try {
    const guides = await storage.getGuides({ status: "published" });
    for (const guide of guides) {
      urls.push({
        loc: `${BASE}/insights/guides/${guide.slug}`,
        lastmod: dateOnly(guide.updatedAt || guide.publishedAt),
        changefreq: "monthly",
        priority: 0.7,
      });
    }
  } catch {}

  try {
    const { getProjectSummaries } = await import("./preconPricingReport");
    for (const project of getProjectSummaries().filter((p) => p.cuts > 0 || p.raises > 0).slice(0, 50)) {
      urls.push({ loc: `${BASE}/projects/${project.slug}`, lastmod: now, changefreq: "weekly", priority: 0.65 });
    }
  } catch {}

  return urlset(urls);
}

export async function buildReportsSitemap() {
  const urls: SitemapUrl[] = [];
  const posts = await storage.getBlogPosts({ status: "published" });
  for (const post of posts) {
    urls.push({
      loc: post.category === "market-analysis" ? `${BASE}/reports/${post.slug}` : `${BASE}/insights/blog/${post.slug}`,
      lastmod: dateOnly(post.updatedAt || post.publishedAt),
      changefreq: "monthly",
      priority: post.category === "market-analysis" ? 0.75 : 0.65,
    });
  }
  return urlset(urls);
}

export async function buildPodcastSitemap() {
  return urlset([
    { loc: `${BASE}/insights/podcast`, lastmod: today(), changefreq: "weekly", priority: 0.8 },
  ]);
}

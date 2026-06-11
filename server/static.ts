import express, { type Express } from "express";
import fs from "fs";
import path from "path";

function injectSeoFallback(html: string, fallback: string | null): string {
  return html.replace(
    /<div id="seo-static-fallback">[\s\S]*?<\/div>/i,
    `<div id="seo-static-fallback">${fallback || ""}</div>`,
  );
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath, { index: false }));

  const indexPath = path.resolve(distPath, "index.html");
  const rawHtml = fs.readFileSync(indexPath, "utf-8");

  app.use("*", async (req, res, next) => {
    // Skip non-HTML requests (assets, API)
    const url = req.originalUrl || "/";
    const pathOnly = url.split("?")[0];
    if (/\.[a-zA-Z0-9]{1,8}$/.test(pathOnly) || pathOnly.startsWith("/api/")) {
      return next();
    }
    const accept = String(req.headers.accept || "");
    if (accept && !accept.includes("text/html") && !accept.includes("*/*")) {
      return next();
    }
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host || "realist.ca";
    const origin = `${protocol}://${host}`;
    let html = rawHtml.replace(/https:\/\/realist\.ca/g, origin);
    let status = 200;
    try {
      const { getMetaForPath, injectMetaIntoHtml, DEFAULT_META, isKnownAppRoute } = await import("./seoMeta");
      const { renderSeoFallback } = await import("./seoRender");
      const reqPath = (req.originalUrl || "/").split("?")[0];
      let meta = await getMetaForPath(reqPath);
      const fallback = await renderSeoFallback(reqPath);
      // Real 404s: a path with no specific meta, no prerendered content, and
      // no matching client route is junk. Serve the SPA shell so soft client
      // recovery still works, but with HTTP 404 + noindex and no
      // self-referencing canonical (a 200 + self-canonical on junk URLs
      // invites junk indexing).
      if (meta === DEFAULT_META && !fallback && !isKnownAppRoute(reqPath)) {
        status = 404;
        meta = {
          title: "Page Not Found | Realist",
          description: "The page you are looking for does not exist. Browse Realist's Canadian real estate tools, reports, and market data instead.",
          noindex: true,
        };
      }
      const canonical = `${origin}${reqPath === "/" ? "" : reqPath}`;
      html = injectMetaIntoHtml(html, meta, canonical, origin);
      html = injectSeoFallback(html, fallback);
    } catch (e) { /* fall through with default html */ }
    res.status(status).set({ "Content-Type": "text/html" }).end(html);
  });
}

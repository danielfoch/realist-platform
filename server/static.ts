import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

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
    try {
      const { getMetaForPath, injectMetaIntoHtml } = await import("./seoMeta");
      const reqPath = (req.originalUrl || "/").split("?")[0];
      const meta = await getMetaForPath(reqPath);
      const canonical = `${origin}${reqPath === "/" ? "" : reqPath}`;
      html = injectMetaIntoHtml(html, meta, canonical, origin);
    } catch (e) { /* fall through with default html */ }
    res.status(200).set({ "Content-Type": "text/html" }).end(html);
  });
}

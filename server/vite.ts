import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

function injectSeoFallback(html: string, fallback: string | null): string {
  return html.replace(
    /<div id="seo-static-fallback">[\s\S]*?<\/div>/i,
    `<div id="seo-static-fallback">${fallback || ""}</div>`,
  );
}

export async function setupVite(server: Server, app: Express) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/vite-hmr" },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    // Skip non-HTML requests (assets with extensions, API calls)
    const pathOnly = url.split("?")[0];
    if (/\.[a-zA-Z0-9]{1,8}$/.test(pathOnly) || pathOnly.startsWith("/api/")) {
      return next();
    }
    const accept = String(req.headers.accept || "");
    if (accept && !accept.includes("text/html") && !accept.includes("*/*")) {
      return next();
    }

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers["x-forwarded-host"] || req.headers.host || "realist.ca";
      const origin = `${protocol}://${host}`;
      template = template.replace(/https:\/\/realist\.ca/g, origin);
      let page = await vite.transformIndexHtml(url, template);
      let status = 200;
      try {
        const { getMetaForPath, injectMetaIntoHtml, DEFAULT_META, isKnownAppRoute } = await import("./seoMeta");
        const { renderSeoFallback } = await import("./seoRender");
        const reqPath = (req.originalUrl || "/").split("?")[0];
        let meta = await getMetaForPath(reqPath);
        const fallback = await renderSeoFallback(reqPath);
        // Mirror the production catch-all: junk URLs get a real 404 + noindex.
        if (meta === DEFAULT_META && !fallback && !isKnownAppRoute(reqPath)) {
          status = 404;
          meta = {
            title: "Page Not Found | Realist",
            description: "The page you are looking for does not exist. Browse Realist's Canadian real estate tools, reports, and market data instead.",
            noindex: true,
          };
        }
        const canonical = `${origin}${reqPath === "/" ? "" : reqPath}`;
        page = injectMetaIntoHtml(page, meta, canonical, origin);
        page = injectSeoFallback(page, fallback);
      } catch (e) { /* fall through with default html */ }
      res.status(status).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

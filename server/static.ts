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

  app.use("*", (req, res) => {
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host || "realist.ca";
    const origin = `${protocol}://${host}`;
    const html = rawHtml.replace(/https:\/\/realist\.ca/g, origin);
    res.status(200).set({ "Content-Type": "text/html" }).end(html);
  });
}
